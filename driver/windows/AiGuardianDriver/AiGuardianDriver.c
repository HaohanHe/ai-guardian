/*
 * AI Guardian Windows Kernel Driver
 * Minifilter Driver for File System Monitoring
 * 
 * 功能：
 * 1. 监控文件操作（创建、读取、写入、删除）
 * 2. 识别 AI Agent 终端进程
 * 3. 拦截危险操作
 * 4. 与用户态通信 (IOCTL)
 */

#include <fltKernel.h>
#include <dontuse.h>
#include <suppress.h>

#pragma prefast(disable:__WARNING_ENCODE_MEMBER_FUNCTION_POINTER, "Not valid for kernel mode drivers")

// 驱动标签
#define AI_GUARDIAN_TAG 'AiGd'

// 设备名称
#define AI_GUARDIAN_DEVICE_NAME L"\\Device\\AiGuardianDevice"
#define AI_GUARDIAN_SYMLINK_NAME L"\\DosDevices\\AiGuardianDevice"

// IOCTL 控制码
#define IOCTL_AI_GUARDIAN_ADD_PROCESS    CTL_CODE(FILE_DEVICE_UNKNOWN, 0x800, METHOD_BUFFERED, FILE_ANY_ACCESS)
#define IOCTL_AI_GUARDIAN_REMOVE_PROCESS CTL_CODE(FILE_DEVICE_UNKNOWN, 0x801, METHOD_BUFFERED, FILE_ANY_ACCESS)
#define IOCTL_AI_GUARDIAN_GET_STATS      CTL_CODE(FILE_DEVICE_UNKNOWN, 0x802, METHOD_BUFFERED, FILE_ANY_ACCESS)
#define IOCTL_AI_GUARDIAN_SET_CONFIG     CTL_CODE(FILE_DEVICE_UNKNOWN, 0x803, METHOD_BUFFERED, FILE_ANY_ACCESS)

// 全局数据
typedef struct _AI_GUARDIAN_DATA {
    PDRIVER_OBJECT DriverObject;
    PFLT_FILTER FilterHandle;
    PDEVICE_OBJECT DeviceObject;
    volatile LONG DriverActive;
    
    // 统计信息
    volatile LONG64 TotalOperationsBlocked;
    volatile LONG64 TotalOperationsAllowed;
    volatile LONG64 AiProcessCount;
} AI_GUARDIAN_DATA, *PAI_GUARDIAN_DATA;

AI_GUARDIAN_DATA g_AiGuardianData = {0};

// AI 终端进程列表（使用哈希表更高效）
#define MAX_AI_PROCESSES 1024
#define PROCESS_HASH_SIZE 256

typedef struct _AI_PROCESS_ENTRY {
    LIST_ENTRY ListEntry;
    HANDLE ProcessId;
    ULONG Flags;
    LARGE_INTEGER AddTime;
} AI_PROCESS_ENTRY, *PAI_PROCESS_ENTRY;

LIST_ENTRY g_AiProcessHashTable[PROCESS_HASH_SIZE];
KSPIN_LOCK g_AiProcessLock;

// 配置数据
typedef struct _AI_GUARDIAN_CONFIG {
    BOOLEAN BlockFileDelete;
    BOOLEAN BlockSystemPathWrite;
    BOOLEAN BlockNetworkConnection;
    BOOLEAN LogAllOperations;
    ULONG RiskThreshold;
} AI_GUARDIAN_CONFIG, *PAI_GUARDIAN_CONFIG;

AI_GUARDIAN_CONFIG g_Config = {
    .BlockFileDelete = TRUE,
    .BlockSystemPathWrite = TRUE,
    .BlockNetworkConnection = TRUE,
    .LogAllOperations = FALSE,
    .RiskThreshold = 70
};

// 敏感路径列表
UNICODE_STRING g_SensitivePaths[] = {
    RTL_CONSTANT_STRING(L"\\Windows\\System32"),
    RTL_CONSTANT_STRING(L"\\Windows\\SysWOW64"),
    RTL_CONSTANT_STRING(L"\\Program Files"),
    RTL_CONSTANT_STRING(L"\\Program Files (x86)"),
    RTL_CONSTANT_STRING(L"\\ProgramData"),
    RTL_CONSTANT_STRING(L"\\Users\\All Users"),
    RTL_CONSTANT_STRING(L"\\Windows\\Registry"),
};

#define SENSITIVE_PATH_COUNT (sizeof(g_SensitivePaths) / sizeof(g_SensitivePaths[0]))

// 初始化哈希表
VOID InitializeProcessHashTable() {
    KeInitializeSpinLock(&g_AiProcessLock);
    for (int i = 0; i < PROCESS_HASH_SIZE; i++) {
        InitializeListHead(&g_AiProcessHashTable[i]);
    }
}

// 计算哈希值
ULONG HashProcessId(HANDLE ProcessId) {
    return ((ULONG)(ULONG_PTR)ProcessId) % PROCESS_HASH_SIZE;
}

// 检查是否是 AI 终端进程
BOOLEAN IsAiTerminalProcess(HANDLE ProcessId) {
    ULONG hash = HashProcessId(ProcessId);
    KIRQL oldIrql;
    BOOLEAN found = FALSE;
    
    KeAcquireSpinLock(&g_AiProcessLock, &oldIrql);
    
    PLIST_ENTRY entry = g_AiProcessHashTable[hash].Flink;
    while (entry != &g_AiProcessHashTable[hash]) {
        PAI_PROCESS_ENTRY procEntry = CONTAINING_RECORD(entry, AI_PROCESS_ENTRY, ListEntry);
        if (procEntry->ProcessId == ProcessId) {
            found = TRUE;
            break;
        }
        entry = entry->Flink;
    }
    
    KeReleaseSpinLock(&g_AiProcessLock, oldIrql);
    return found;
}

// 添加 AI 终端进程
NTSTATUS AddAiProcess(HANDLE ProcessId) {
    if (IsAiTerminalProcess(ProcessId)) {
        return STATUS_SUCCESS;
    }
    
    PAI_PROCESS_ENTRY entry = ExAllocatePool2(POOL_FLAG_NON_PAGED, sizeof(AI_PROCESS_ENTRY), AI_GUARDIAN_TAG);
    if (!entry) {
        return STATUS_INSUFFICIENT_RESOURCES;
    }
    
    entry->ProcessId = ProcessId;
    entry->Flags = 0;
    KeQuerySystemTime(&entry->AddTime);
    
    ULONG hash = HashProcessId(ProcessId);
    KIRQL oldIrql;
    
    KeAcquireSpinLock(&g_AiProcessLock, &oldIrql);
    InsertTailList(&g_AiProcessHashTable[hash], &entry->ListEntry);
    KeReleaseSpinLock(&g_AiProcessLock, oldIrql);
    
    InterlockedIncrement64(&g_AiGuardianData.AiProcessCount);
    InterlockedIncrement64(&g_AiGuardianData.TotalOperationsAllowed);
    
    KdPrint(("AI Guardian: Added AI process %p (Total: %lld)\n", 
             ProcessId, g_AiGuardianData.AiProcessCount));
    
    return STATUS_SUCCESS;
}

// 移除 AI 终端进程
NTSTATUS RemoveAiProcess(HANDLE ProcessId) {
    ULONG hash = HashProcessId(ProcessId);
    KIRQL oldIrql;
    BOOLEAN found = FALSE;
    
    KeAcquireSpinLock(&g_AiProcessLock, &oldIrql);
    
    PLIST_ENTRY entry = g_AiProcessHashTable[hash].Flink;
    while (entry != &g_AiProcessHashTable[hash]) {
        PAI_PROCESS_ENTRY procEntry = CONTAINING_RECORD(entry, AI_PROCESS_ENTRY, ListEntry);
        if (procEntry->ProcessId == ProcessId) {
            RemoveEntryList(&procEntry->ListEntry);
            ExFreePoolWithTag(procEntry, AI_GUARDIAN_TAG);
            found = TRUE;
            break;
        }
        entry = entry->Flink;
    }
    
    KeReleaseSpinLock(&g_AiProcessLock, oldIrql);
    
    if (found) {
        InterlockedDecrement64(&g_AiGuardianData.AiProcessCount);
        KdPrint(("AI Guardian: Removed AI process %p\n", ProcessId));
        return STATUS_SUCCESS;
    }
    
    return STATUS_NOT_FOUND;
}

// 清理所有 AI 进程
VOID CleanupAllAiProcesses() {
    KIRQL oldIrql;
    KeAcquireSpinLock(&g_AiProcessLock, &oldIrql);
    
    for (int i = 0; i < PROCESS_HASH_SIZE; i++) {
        while (!IsListEmpty(&g_AiProcessHashTable[i])) {
            PLIST_ENTRY entry = RemoveHeadList(&g_AiProcessHashTable[i]);
            PAI_PROCESS_ENTRY procEntry = CONTAINING_RECORD(entry, AI_PROCESS_ENTRY, ListEntry);
            ExFreePoolWithTag(procEntry, AI_GUARDIAN_TAG);
        }
    }
    
    KeReleaseSpinLock(&g_AiProcessLock, oldIrql);
}

// 检查路径是否是敏感路径
BOOLEAN IsSensitivePath(PUNICODE_STRING Path) {
    if (!Path || !Path->Buffer || Path->Length == 0) {
        return FALSE;
    }
    
    for (int i = 0; i < SENSITIVE_PATH_COUNT; i++) {
        if (RtlPrefixUnicodeString(&g_SensitivePaths[i], Path, TRUE)) {
            return TRUE;
        }
    }
    
    return FALSE;
}

// 检查是否是用户数据路径
BOOLEAN IsUserDataPath(PUNICODE_STRING Path) {
    if (!Path || !Path->Buffer) {
        return FALSE;
    }
    
    UNICODE_STRING usersPath;
    RtlInitUnicodeString(&usersPath, L"\\Users\\");
    
    return RtlPrefixUnicodeString(&usersPath, Path, TRUE);
}

// 记录操作日志
VOID LogOperation(HANDLE ProcessId, PCWSTR Operation, PUNICODE_STRING Path, BOOLEAN Blocked) {
    if (!g_Config.LogAllOperations && !Blocked) {
        return;
    }
    
    if (Blocked) {
        InterlockedIncrement64(&g_AiGuardianData.TotalOperationsBlocked);
        KdPrint(("AI Guardian: BLOCKED - PID:%p %S %wZ\n", ProcessId, Operation, Path));
    } else {
        InterlockedIncrement64(&g_AiGuardianData.TotalOperationsAllowed);
    }
}

// PreCreate 回调 - 文件打开/创建前拦截
FLT_PREOP_CALLBACK_STATUS
AiGuardianPreCreate(
    _Inout_ PFLT_CALLBACK_DATA Data,
    _In_ PCFLT_RELATED_OBJECTS FltObjects,
    _Flt_CompletionContext_Outptr_ PVOID *CompletionContext
) {
    UNREFERENCED_PARAMETER(CompletionContext);
    UNREFERENCED_PARAMETER(FltObjects);
    
    HANDLE processId = PsGetCurrentProcessId();
    
    // 快速路径：如果不是 AI 终端，直接放行
    if (!IsAiTerminalProcess(processId)) {
        return FLT_PREOP_SUCCESS_NO_CALLBACK;
    }
    
    // 获取文件路径
    PFLT_FILE_NAME_INFORMATION nameInfo = NULL;
    NTSTATUS status = FltGetFileNameInformation(
        Data,
        FLT_FILE_NAME_NORMALIZED | FLT_FILE_NAME_QUERY_DEFAULT,
        &nameInfo
    );
    
    if (!NT_SUCCESS(status)) {
        return FLT_PREOP_SUCCESS_NO_CALLBACK;
    }
    
    // 检查是否是敏感路径
    if (IsSensitivePath(&nameInfo->Name)) {
        ULONG createOptions = Data->Iopb->Parameters.Create.Options;
        ULONG disposition = (createOptions >> 24) & 0xFF;
        
        // 检查删除操作
        if (g_Config.BlockFileDelete && 
            (disposition == FILE_DELETE_ON_CLOSE ||
             (Data->Iopb->Parameters.Create.SecurityContext &&
              (Data->Iopb->Parameters.Create.SecurityContext->DesiredAccess & DELETE)))) {
            
            LogOperation(processId, L"DELETE", &nameInfo->Name, TRUE);
            
            Data->IoStatus.Status = STATUS_ACCESS_DENIED;
            Data->IoStatus.Information = 0;
            
            FltReleaseFileNameInformation(nameInfo);
            return FLT_PREOP_COMPLETE;
        }
        
        // 检查写入操作
        if (g_Config.BlockSystemPathWrite) {
            PACCESS_STATE accessState = Data->Iopb->Parameters.Create.SecurityContext ?
                Data->Iopb->Parameters.Create.SecurityContext->AccessState : NULL;
            
            if (accessState && (accessState->PreviouslyGrantedAccess & FILE_WRITE_DATA)) {
                LogOperation(processId, L"WRITE", &nameInfo->Name, TRUE);
                
                Data->IoStatus.Status = STATUS_ACCESS_DENIED;
                Data->IoStatus.Information = 0;
                
                FltReleaseFileNameInformation(nameInfo);
                return FLT_PREOP_COMPLETE;
            }
        }
    }
    
    // 检查用户数据删除
    if (g_Config.BlockFileDelete && IsUserDataPath(&nameInfo->Name)) {
        ULONG createOptions = Data->Iopb->Parameters.Create.Options;
        ULONG disposition = (createOptions >> 24) & 0xFF;
        
        if (disposition == FILE_DELETE_ON_CLOSE) {
            LogOperation(processId, L"DELETE_USER_DATA", &nameInfo->Name, TRUE);
            
            Data->IoStatus.Status = STATUS_ACCESS_DENIED;
            Data->IoStatus.Information = 0;
            
            FltReleaseFileNameInformation(nameInfo);
            return FLT_PREOP_COMPLETE;
        }
    }
    
    LogOperation(processId, L"CREATE", &nameInfo->Name, FALSE);
    FltReleaseFileNameInformation(nameInfo);
    return FLT_PREOP_SUCCESS_NO_CALLBACK;
}

// PreWrite 回调 - 文件写入前拦截
FLT_PREOP_CALLBACK_STATUS
AiGuardianPreWrite(
    _Inout_ PFLT_CALLBACK_DATA Data,
    _In_ PCFLT_RELATED_OBJECTS FltObjects,
    _Flt_CompletionContext_Outptr_ PVOID *CompletionContext
) {
    UNREFERENCED_PARAMETER(CompletionContext);
    UNREFERENCED_PARAMETER(FltObjects);
    
    HANDLE processId = PsGetCurrentProcessId();
    
    if (!IsAiTerminalProcess(processId)) {
        return FLT_PREOP_SUCCESS_NO_CALLBACK;
    }
    
    if (!g_Config.BlockSystemPathWrite) {
        return FLT_PREOP_SUCCESS_NO_CALLBACK;
    }
    
    // 获取文件路径
    PFLT_FILE_NAME_INFORMATION nameInfo = NULL;
    NTSTATUS status = FltGetFileNameInformation(
        Data,
        FLT_FILE_NAME_NORMALIZED | FLT_FILE_NAME_QUERY_DEFAULT,
        &nameInfo
    );
    
    if (NT_SUCCESS(status)) {
        if (IsSensitivePath(&nameInfo->Name)) {
            LogOperation(processId, L"WRITE", &nameInfo->Name, TRUE);
            
            Data->IoStatus.Status = STATUS_ACCESS_DENIED;
            Data->IoStatus.Information = 0;
            
            FltReleaseFileNameInformation(nameInfo);
            return FLT_PREOP_COMPLETE;
        }
        
        FltReleaseFileNameInformation(nameInfo);
    }
    
    return FLT_PREOP_SUCCESS_NO_CALLBACK;
}

// PreSetInformation 回调 - 设置文件信息前拦截
FLT_PREOP_CALLBACK_STATUS
AiGuardianPreSetInformation(
    _Inout_ PFLT_CALLBACK_DATA Data,
    _In_ PCFLT_RELATED_OBJECTS FltObjects,
    _Flt_CompletionContext_Outptr_ PVOID *CompletionContext
) {
    UNREFERENCED_PARAMETER(CompletionContext);
    UNREFERENCED_PARAMETER(FltObjects);
    
    HANDLE processId = PsGetCurrentProcessId();
    
    if (!IsAiTerminalProcess(processId)) {
        return FLT_PREOP_SUCCESS_NO_CALLBACK;
    }
    
    if (!g_Config.BlockFileDelete) {
        return FLT_PREOP_SUCCESS_NO_CALLBACK;
    }
    
    // 检查是否是删除操作
    if (Data->Iopb->Parameters.SetFileInformation.FileInformationClass == FileDispositionInformation ||
        Data->Iopb->Parameters.SetFileInformation.FileInformationClass == FileDispositionInformationEx) {
        
        PFILE_DISPOSITION_INFORMATION dispInfo = 
            (PFILE_DISPOSITION_INFORMATION)Data->Iopb->Parameters.SetFileInformation.InfoBuffer;
        
        if (dispInfo && dispInfo->DeleteFile) {
            // 获取文件路径
            PFLT_FILE_NAME_INFORMATION nameInfo = NULL;
            NTSTATUS status = FltGetFileNameInformation(
                Data,
                FLT_FILE_NAME_NORMALIZED | FLT_FILE_NAME_QUERY_DEFAULT,
                &nameInfo
            );
            
            if (NT_SUCCESS(status)) {
                if (IsSensitivePath(&nameInfo->Name) || IsUserDataPath(&nameInfo->Name)) {
                    LogOperation(processId, L"SET_DELETE", &nameInfo->Name, TRUE);
                    
                    Data->IoStatus.Status = STATUS_ACCESS_DENIED;
                    Data->IoStatus.Information = 0;
                    
                    FltReleaseFileNameInformation(nameInfo);
                    return FLT_PREOP_COMPLETE;
                }
                
                FltReleaseFileNameInformation(nameInfo);
            }
        }
    }
    
    return FLT_PREOP_SUCCESS_NO_CALLBACK;
}

// 回调函数表
CONST FLT_OPERATION_REGISTRATION Callbacks[] = {
    { IRP_MJ_CREATE, 0, AiGuardianPreCreate, NULL },
    { IRP_MJ_WRITE, 0, AiGuardianPreWrite, NULL },
    { IRP_MJ_SET_INFORMATION, 0, AiGuardianPreSetInformation, NULL },
    { IRP_MJ_OPERATION_END }
};

// 上下文定义
CONST FLT_CONTEXT_REGISTRATION ContextNotifications[] = {
    { FLT_CONTEXT_END }
};

// 驱动卸载回调
VOID AiGuardianUnload(
    _In_ FLT_FILTER_UNLOAD_FLAGS Flags
) {
    UNREFERENCED_PARAMETER(Flags);
    
    KdPrint(("AI Guardian: Driver unloading\n"));
    
    InterlockedExchange(&g_AiGuardianData.DriverActive, 0);
    
    // 清理 AI 进程列表
    CleanupAllAiProcesses();
    
    // 停止过滤
    if (g_AiGuardianData.FilterHandle) {
        FltUnregisterFilter(g_AiGuardianData.FilterHandle);
        g_AiGuardianData.FilterHandle = NULL;
    }
    
    // 删除设备
    if (g_AiGuardianData.DeviceObject) {
        IoDeleteDevice(g_AiGuardianData.DeviceObject);
        g_AiGuardianData.DeviceObject = NULL;
    }
    
    KdPrint(("AI Guardian: Driver unloaded\n"));
}

// 实例回调
NTSTATUS AiGuardianInstanceSetup(
    _In_ PCFLT_RELATED_OBJECTS FltObjects,
    _In_ FLT_INSTANCE_SETUP_FLAGS Flags,
    _In_ DEVICE_TYPE VolumeDeviceType,
    _In_ FLT_FILESYSTEM_TYPE VolumeFilesystemType
) {
    UNREFERENCED_PARAMETER(FltObjects);
    UNREFERENCED_PARAMETER(Flags);
    UNREFERENCED_PARAMETER(VolumeDeviceType);
    UNREFERENCED_PARAMETER(VolumeFilesystemType);
    
    return STATUS_SUCCESS;
}

NTSTATUS AiGuardianInstanceQueryTeardown(
    _In_ PCFLT_RELATED_OBJECTS FltObjects,
    _In_ FLT_INSTANCE_QUERY_TEARDOWN_FLAGS Flags
) {
    UNREFERENCED_PARAMETER(FltObjects);
    UNREFERENCED_PARAMETER(Flags);
    
    return STATUS_SUCCESS;
}

// 过滤器注册
CONST FLT_REGISTRATION FilterRegistration = {
    sizeof(FLT_REGISTRATION),
    FLT_REGISTRATION_VERSION,
    0,
    ContextNotifications,
    Callbacks,
    AiGuardianUnload,
    AiGuardianInstanceSetup,
    AiGuardianInstanceQueryTeardown,
    NULL,
    NULL,
};

// 设备控制处理
NTSTATUS AiGuardianDeviceControl(
    _In_ PDEVICE_OBJECT DeviceObject,
    _In_ PIRP Irp
) {
    UNREFERENCED_PARAMETER(DeviceObject);
    
    PIO_STACK_LOCATION irpStack = IoGetCurrentIrpStackLocation(Irp);
    NTSTATUS status = STATUS_SUCCESS;
    ULONG bytesReturned = 0;
    
    PVOID inputBuffer = Irp->AssociatedIrp.SystemBuffer;
    ULONG inputBufferLength = irpStack->Parameters.DeviceIoControl.InputBufferLength;
    PVOID outputBuffer = Irp->AssociatedIrp.SystemBuffer;
    ULONG outputBufferLength = irpStack->Parameters.DeviceIoControl.OutputBufferLength;
    
    switch (irpStack->Parameters.DeviceIoControl.IoControlCode) {
        case IOCTL_AI_GUARDIAN_ADD_PROCESS: {
            if (inputBufferLength < sizeof(ULONG)) {
                status = STATUS_BUFFER_TOO_SMALL;
                break;
            }
            
            ULONG pid = *(PULONG)inputBuffer;
            HANDLE processId = (HANDLE)(ULONG_PTR)pid;
            
            status = AddAiProcess(processId);
            KdPrint(("AI Guardian: IOCTL Add process %lu, status 0x%08X\n", pid, status));
            break;
        }
        
        case IOCTL_AI_GUARDIAN_REMOVE_PROCESS: {
            if (inputBufferLength < sizeof(ULONG)) {
                status = STATUS_BUFFER_TOO_SMALL;
                break;
            }
            
            ULONG pid = *(PULONG)inputBuffer;
            HANDLE processId = (HANDLE)(ULONG_PTR)pid;
            
            status = RemoveAiProcess(processId);
            KdPrint(("AI Guardian: IOCTL Remove process %lu, status 0x%08X\n", pid, status));
            break;
        }
        
        case IOCTL_AI_GUARDIAN_GET_STATS: {
            typedef struct _AI_GUARDIAN_STATS {
                LONG64 TotalOperationsBlocked;
                LONG64 TotalOperationsAllowed;
                LONG64 AiProcessCount;
                BOOLEAN DriverActive;
            } AI_GUARDIAN_STATS, *PAI_GUARDIAN_STATS;
            
            if (outputBufferLength < sizeof(AI_GUARDIAN_STATS)) {
                status = STATUS_BUFFER_TOO_SMALL;
                break;
            }
            
            PAI_GUARDIAN_STATS stats = (PAI_GUARDIAN_STATS)outputBuffer;
            stats->TotalOperationsBlocked = g_AiGuardianData.TotalOperationsBlocked;
            stats->TotalOperationsAllowed = g_AiGuardianData.TotalOperationsAllowed;
            stats->AiProcessCount = g_AiGuardianData.AiProcessCount;
            stats->DriverActive = (BOOLEAN)g_AiGuardianData.DriverActive;
            
            bytesReturned = sizeof(AI_GUARDIAN_STATS);
            break;
        }
        
        case IOCTL_AI_GUARDIAN_SET_CONFIG: {
            if (inputBufferLength < sizeof(AI_GUARDIAN_CONFIG)) {
                status = STATUS_BUFFER_TOO_SMALL;
                break;
            }
            
            PAI_GUARDIAN_CONFIG newConfig = (PAI_GUARDIAN_CONFIG)inputBuffer;
            RtlCopyMemory(&g_Config, newConfig, sizeof(AI_GUARDIAN_CONFIG));
            
            KdPrint(("AI Guardian: Config updated - BlockDelete:%d BlockWrite:%d\n",
                     g_Config.BlockFileDelete, g_Config.BlockSystemPathWrite));
            break;
        }
        
        default:
            status = STATUS_INVALID_DEVICE_REQUEST;
            break;
    }
    
    Irp->IoStatus.Status = status;
    Irp->IoStatus.Information = bytesReturned;
    IoCompleteRequest(Irp, IO_NO_INCREMENT);
    
    return status;
}

// 创建/关闭处理
NTSTATUS AiGuardianCreateClose(
    _In_ PDEVICE_OBJECT DeviceObject,
    _In_ PIRP Irp
) {
    UNREFERENCED_PARAMETER(DeviceObject);
    
    Irp->IoStatus.Status = STATUS_SUCCESS;
    Irp->IoStatus.Information = 0;
    IoCompleteRequest(Irp, IO_NO_INCREMENT);
    
    return STATUS_SUCCESS;
}

// 驱动入口
NTSTATUS DriverEntry(
    _In_ PDRIVER_OBJECT DriverObject,
    _In_ PUNICODE_STRING RegistryPath
) {
    UNREFERENCED_PARAMETER(RegistryPath);
    
    NTSTATUS status;
    UNICODE_STRING deviceName;
    UNICODE_STRING symlinkName;
    
    KdPrint(("AI Guardian: Driver loading v2.0\n"));
    
    // 初始化全局数据
    RtlZeroMemory(&g_AiGuardianData, sizeof(g_AiGuardianData));
    InitializeProcessHashTable();
    
    // 创建设备对象
    RtlInitUnicodeString(&deviceName, AI_GUARDIAN_DEVICE_NAME);
    RtlInitUnicodeString(&symlinkName, AI_GUARDIAN_SYMLINK_NAME);
    
    status = IoCreateDevice(
        DriverObject,
        0,
        &deviceName,
        FILE_DEVICE_UNKNOWN,
        FILE_DEVICE_SECURE_OPEN,
        FALSE,
        &g_AiGuardianData.DeviceObject
    );
    
    if (!NT_SUCCESS(status)) {
        KdPrint(("AI Guardian: Failed to create device: 0x%08X\n", status));
        return status;
    }
    
    // 创建符号链接
    status = IoCreateSymbolicLink(&symlinkName, &deviceName);
    if (!NT_SUCCESS(status)) {
        KdPrint(("AI Guardian: Failed to create symlink: 0x%08X\n", status));
        IoDeleteDevice(g_AiGuardianData.DeviceObject);
        return status;
    }
    
    // 设置分发函数
    DriverObject->MajorFunction[IRP_MJ_CREATE] = AiGuardianCreateClose;
    DriverObject->MajorFunction[IRP_MJ_CLOSE] = AiGuardianCreateClose;
    DriverObject->MajorFunction[IRP_MJ_DEVICE_CONTROL] = AiGuardianDeviceControl;
    
    // 注册 Minifilter
    status = FltRegisterFilter(
        DriverObject,
        &FilterRegistration,
        &g_AiGuardianData.FilterHandle
    );
    
    if (!NT_SUCCESS(status)) {
        KdPrint(("AI Guardian: Failed to register filter: 0x%08X\n", status));
        IoDeleteSymbolicLink(&symlinkName);
        IoDeleteDevice(g_AiGuardianData.DeviceObject);
        return status;
    }
    
    // 启动过滤
    status = FltStartFiltering(g_AiGuardianData.FilterHandle);
    
    if (!NT_SUCCESS(status)) {
        KdPrint(("AI Guardian: Failed to start filtering: 0x%08X\n", status));
        FltUnregisterFilter(g_AiGuardianData.FilterHandle);
        IoDeleteSymbolicLink(&symlinkName);
        IoDeleteDevice(g_AiGuardianData.DeviceObject);
        return status;
    }
    
    g_AiGuardianData.DriverObject = DriverObject;
    InterlockedExchange(&g_AiGuardianData.DriverActive, 1);
    
    KdPrint(("AI Guardian: Driver loaded successfully\n"));
    KdPrint(("AI Guardian: Features - BlockDelete:%d BlockWrite:%d\n",
             g_Config.BlockFileDelete, g_Config.BlockSystemPathWrite));
    
    return STATUS_SUCCESS;
}
