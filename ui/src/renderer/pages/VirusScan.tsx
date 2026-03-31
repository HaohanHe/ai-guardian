import React, { useState, useEffect } from 'react';
import { 
  ShieldExclamationIcon, 
  ComputerDesktopIcon,
  FolderIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  EyeIcon,
  ClockIcon,
  CpuChipIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const VirusScan: React.FC = () => {
  const [scanMode, setScanMode] = useState<'idle' | 'scanning' | 'paused' | 'completed'>('idle');
  const [scanProgress, setScanProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [scannedFiles, setScannedFiles] = useState(0);
  const [threatsFound, setThreatsFound] = useState(0);
  const [scanType, setScanType] = useState<'quick' | 'full' | 'custom'>('quick');
  const [scanDuration, setScanDuration] = useState(0);
  const [selectedThreat, setSelectedThreat] = useState<any>(null);

  const [threats] = useState([
    { id: 1, name: 'Trojan.Generic.12345', path: 'C:\\Users\\User\\Downloads\\suspicious.exe', severity: 'high', status: 'detected', type: 'Trojan' },
    { id: 2, name: 'PUP.Optional.Toolbar', path: 'C:\\Program Files\\Toolbar\\toolbar.dll', severity: 'medium', status: 'detected', type: 'PUP' },
    { id: 3, name: 'Virus.Win32.Generic', path: 'D:\\Temp\\infected.zip', severity: 'critical', status: 'quarantined', type: 'Virus' },
  ]);

  const scanOptions = [
    { 
      type: 'quick', 
      name: '快速扫描', 
      icon: MagnifyingGlassIcon, 
      color: 'from-blue-500 to-cyan-500',
      description: '扫描系统关键区域，快速检测威胁',
      estimatedTime: '2-5分钟'
    },
    { 
      type: 'full', 
      name: '全盘查杀', 
      icon: ComputerDesktopIcon, 
      color: 'from-red-500 to-orange-500',
      description: '深度扫描所有文件，确保全面安全',
      estimatedTime: '30-60分钟'
    },
    { 
      type: 'custom', 
      name: '自定义扫描', 
      icon: FolderIcon, 
      color: 'from-purple-500 to-pink-500',
      description: '选择特定文件或文件夹进行扫描',
      estimatedTime: '取决于选择'
    },
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (scanMode === 'scanning') {
      interval = setInterval(() => {
        setScanDuration(prev => prev + 1);
        setScannedFiles(prev => prev + Math.floor(Math.random() * 10) + 5);
        setScanProgress(prev => {
          if (prev >= 100) {
            setScanMode('completed');
            toast.success('扫描完成！', { icon: '✅' });
            return 100;
          }
          const increment = Math.random() * 2;
          if (prev > 30 && prev < 32 && threatsFound === 0) {
            setThreatsFound(2);
            toast.error('发现威胁！', { icon: '⚠️' });
          }
          return Math.min(prev + increment, 100);
        });
        
        const files = [
          'C:\\Windows\\System32\\ntdll.dll',
          'C:\\Users\\User\\Documents\\report.pdf',
          'C:\\Program Files\\Common Files\\shared.dll',
          'D:\\Projects\\source\\main.js',
          'C:\\Users\\User\\Downloads\\installer.exe',
        ];
        setCurrentFile(files[Math.floor(Math.random() * files.length)]);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [scanMode, threatsFound]);

  const startScan = () => {
    setScanMode('scanning');
    setScanProgress(0);
    setScannedFiles(0);
    setThreatsFound(0);
    setScanDuration(0);
    toast.success(`${scanType === 'quick' ? '快速扫描' : scanType === 'full' ? '全盘查杀' : '自定义扫描'}已启动`, {
      icon: '🔍',
    });
  };

  const pauseScan = () => {
    setScanMode('paused');
    toast('扫描已暂停', { icon: '⏸️' });
  };

  const resumeScan = () => {
    setScanMode('scanning');
    toast('扫描已继续', { icon: '▶️' });
  };

  const stopScan = () => {
    setScanMode('idle');
    toast('扫描已停止', { icon: '⏹️' });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500 bg-red-500/10';
      case 'high': return 'text-orange-500 bg-orange-500/10';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10';
      default: return 'text-green-500 bg-green-500/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'detected': return ExclamationTriangleIcon;
      case 'quarantined': return FolderIcon;
      case 'removed': return CheckCircleIcon;
      default: return ExclamationTriangleIcon;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">病毒查杀</h1>
          <p className="text-slate-400">扫描您的电脑，发现并清除威胁</p>
        </div>
        {scanMode === 'idle' && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <ClockIcon className="w-4 h-4" />
            <span>上次扫描: 2小时前</span>
          </div>
        )}
      </div>

      {/* Scan Mode Selection - Only show when not scanning */}
      {scanMode === 'idle' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {scanOptions.map((option) => (
            <button
              key={option.type}
              onClick={() => {
                setScanType(option.type as any);
              }}
              className={`relative overflow-hidden rounded-2xl border-2 p-6 text-left transition-all duration-300 ${
                scanType === option.type
                  ? `border-transparent bg-gradient-to-br ${option.color} shadow-lg`
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
              }`}
            >
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${
                scanType === option.type ? 'bg-white/20' : `bg-gradient-to-br ${option.color}`
              }`}>
                <option.icon className={`w-7 h-7 ${scanType === option.type ? 'text-white' : 'text-white'}`} />
              </div>
              <h3 className={`text-lg font-bold mb-2 ${scanType === option.type ? 'text-white' : 'text-white'}`}>
                {option.name}
              </h3>
              <p className={`text-sm mb-3 ${scanType === option.type ? 'text-white/80' : 'text-slate-400'}`}>
                {option.description}
              </p>
              <div className={`flex items-center gap-2 text-xs ${scanType === option.type ? 'text-white/70' : 'text-slate-500'}`}>
                <ClockIcon className="w-4 h-4" />
                <span>{option.estimatedTime}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Scan Controls */}
      {(scanMode !== 'idle') && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 border border-slate-600/50">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          </div>
          
          <div className="relative p-8">
            {/* Progress Circle */}
            <div className="flex flex-col lg:flex-row items-center gap-8">
              <div className="relative">
                <svg className="w-48 h-48 transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="80"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="transparent"
                    className="text-slate-700"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="80"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="transparent"
                    strokeLinecap="round"
                    className="text-green-500 transition-all duration-300"
                    style={{
                      strokeDasharray: `${2 * Math.PI * 80}`,
                      strokeDashoffset: `${2 * Math.PI * 80 * (1 - scanProgress / 100)}`,
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold">{Math.round(scanProgress)}%</span>
                  <span className="text-sm text-slate-400">
                    {scanMode === 'scanning' ? '扫描中' : scanMode === 'paused' ? '已暂停' : '已完成'}
                  </span>
                </div>
              </div>

              {/* Scan Stats */}
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-700/30 rounded-xl p-4">
                    <p className="text-sm text-slate-400 mb-1">已扫描文件</p>
                    <p className="text-2xl font-bold">{scannedFiles.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-700/30 rounded-xl p-4">
                    <p className="text-sm text-slate-400 mb-1">发现威胁</p>
                    <p className="text-2xl font-bold text-red-500">{threatsFound}</p>
                  </div>
                  <div className="bg-slate-700/30 rounded-xl p-4">
                    <p className="text-sm text-slate-400 mb-1">扫描时间</p>
                    <p className="text-2xl font-bold">{formatDuration(scanDuration)}</p>
                  </div>
                  <div className="bg-slate-700/30 rounded-xl p-4">
                    <p className="text-sm text-slate-400 mb-1">扫描类型</p>
                    <p className="text-2xl font-bold">
                      {scanType === 'quick' ? '快速' : scanType === 'full' ? '全盘' : '自定义'}
                    </p>
                  </div>
                </div>

                {/* Current File */}
                {currentFile && (
                  <div className="bg-slate-700/30 rounded-xl p-4">
                    <p className="text-sm text-slate-400 mb-2 flex items-center gap-2">
                      <CpuChipIcon className="w-4 h-4" />
                      当前扫描:
                    </p>
                    <p className="text-sm font-mono text-slate-300 truncate">{currentFile}</p>
                  </div>
                )}

                {/* Control Buttons */}
                <div className="flex gap-3">
                  {scanMode === 'scanning' && (
                    <>
                      <button
                        onClick={pauseScan}
                        className="flex-1 py-3 px-6 rounded-xl bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 transition-colors font-semibold flex items-center justify-center gap-2"
                      >
                        <PauseIcon className="w-5 h-5" />
                        暂停
                      </button>
                      <button
                        onClick={stopScan}
                        className="flex-1 py-3 px-6 rounded-xl bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors font-semibold flex items-center justify-center gap-2"
                      >
                        <StopIcon className="w-5 h-5" />
                        停止
                      </button>
                    </>
                  )}
                  {scanMode === 'paused' && (
                    <>
                      <button
                        onClick={resumeScan}
                        className="flex-1 py-3 px-6 rounded-xl bg-green-500/20 text-green-500 hover:bg-green-500/30 transition-colors font-semibold flex items-center justify-center gap-2"
                      >
                        <PlayIcon className="w-5 h-5" />
                        继续
                      </button>
                      <button
                        onClick={stopScan}
                        className="flex-1 py-3 px-6 rounded-xl bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors font-semibold flex items-center justify-center gap-2"
                      >
                        <StopIcon className="w-5 h-5" />
                        停止
                      </button>
                    </>
                  )}
                  {scanMode === 'completed' && (
                    <button
                      onClick={() => setScanMode('idle')}
                      className="flex-1 py-3 px-6 rounded-xl bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 transition-colors font-semibold flex items-center justify-center gap-2"
                    >
                      <ArrowPathIcon className="w-5 h-5" />
                      新扫描
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Start Button - Only show when idle */}
      {scanMode === 'idle' && (
        <button
          onClick={startScan}
          className="w-full py-4 px-8 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-all duration-300 font-bold text-lg flex items-center justify-center gap-3"
        >
          <PlayIcon className="w-6 h-6" />
          开始{scanType === 'quick' ? '快速扫描' : scanType === 'full' ? '全盘查杀' : '自定义扫描'}
        </button>
      )}

      {/* Threats List */}
      <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 overflow-hidden">
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShieldExclamationIcon className="w-5 h-5 text-red-400" />
              检测到的威胁
            </h2>
            <span className="text-sm text-slate-400">{threats.length} 个威胁</span>
          </div>
        </div>
        
        <div className="divide-y divide-slate-700/50">
          {threats.map((threat) => {
            const StatusIcon = getStatusIcon(threat.status);
            return (
              <div
                key={threat.id}
                onClick={() => setSelectedThreat(threat)}
                className={`p-4 hover:bg-slate-700/30 transition-colors cursor-pointer ${
                  selectedThreat?.id === threat.id ? 'bg-slate-700/50' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${getSeverityColor(threat.severity)}`}>
                    <StatusIcon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold truncate">{threat.name}</h3>
                        <p className="text-sm text-slate-400 font-mono truncate mt-1">{threat.path}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getSeverityColor(threat.severity)}`}>
                          {threat.severity === 'critical' ? '严重' : threat.severity === 'high' ? '高危' : '中危'}
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">
                          {threat.type}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <button className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1">
                        <TrashIcon className="w-4 h-4" />
                        立即处理
                      </button>
                      <button className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
                        <EyeIcon className="w-4 h-4" />
                        查看详情
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default VirusScan;
