# AI Guardian Linux eBPF Makefile

CLANG ?= clang
LLC ?= llc
BPFTOOL ?= bpftool
ARCH ?= $(shell uname -m | sed 's/x86_64/x86/' | sed 's/aarch64/arm64/')

# eBPF program source and target
BPF_SRC := ai_guardian.bpf.c
BPF_OBJ := ai_guardian.bpf.o

# Kernel release
KERNEL_RELEASE := $(shell uname -r)

# Function to find kernel headers path
# Checks multiple common locations across different distributions
find-kernel-headers = $(firstword $(wildcard \
    /usr/src/linux-headers-$(KERNEL_RELEASE) \
    /usr/src/kernels/$(KERNEL_RELEASE) \
    /lib/modules/$(KERNEL_RELEASE)/build \
    /usr/src/linux-$(KERNEL_RELEASE) \
))

# Kernel headers path with environment variable override
# Users can set LINUX_HEADERS to override auto-detection
LINUX_HEADERS ?= $(call find-kernel-headers)

# Basic kernel headers (usually /usr/include on most systems)
KERNEL_HEADERS ?= /usr/include

# Validate kernel headers path
ifeq ($(LINUX_HEADERS),)
    $(error Unable to locate kernel headers. Please install kernel headers for your distribution, or set LINUX_HEADERS environment variable. Common locations: /usr/src/linux-headers-$(KERNEL_RELEASE), /usr/src/kernels/$(KERNEL_RELEASE), /lib/modules/$(KERNEL_RELEASE)/build)
endif

ifneq ($(wildcard $(LINUX_HEADERS)/include),)
    # Kernel headers found
else
    $(error Kernel headers directory not found at $(LINUX_HEADERS). Please set LINUX_HEADERS to the correct path)
endif

# Compiler flags for eBPF
BPF_CFLAGS := -O2 -target bpf -D__TARGET_ARCH_$(ARCH) \
    -I$(KERNEL_HEADERS) \
    -I$(LINUX_HEADERS)/include \
    -I$(LINUX_HEADERS)/arch/$(ARCH)/include \
    -I$(LINUX_HEADERS)/tools/lib \
    -I/usr/include/bpf \
    -Wall -g

.PHONY: all clean vmlinux info

all: vmlinux $(BPF_OBJ)

# Generate vmlinux.h from kernel BTF
vmlinux.h:
	@if [ -f /sys/kernel/btf/vmlinux ]; then \
		if command -v $(BPFTOOL) >/dev/null 2>&1; then \
			echo "Generating vmlinux.h from kernel BTF..."; \
			$(BPFTOOL) btf dump file /sys/kernel/btf/vmlinux format c > vmlinux.h; \
		else \
			echo "Warning: bpftool not found, trying to use system vmlinux.h"; \
			if [ -f $(LINUX_HEADERS)/include/vmlinux.h ]; then \
				cp $(LINUX_HEADERS)/include/vmlinux.h .; \
			else \
				echo "Error: vmlinux.h not found. Please install bpftool or kernel headers."; \
				exit 1; \
			fi \
		fi \
	else \
		echo "Error: /sys/kernel/btf/vmlinux not found. Kernel BTF support required."; \
		exit 1; \
	fi

# Compile eBPF program
$(BPF_OBJ): $(BPF_SRC) vmlinux.h
	@echo "Compiling eBPF program: $<"
	@echo "Using kernel headers: $(LINUX_HEADERS)"
	$(CLANG) $(BPF_CFLAGS) -c $< -o $@
	@echo "eBPF program compiled: $@"

# Generate vmlinux.h if needed (requires bpftool)
vmlinux:
	@if command -v $(BPFTOOL) >/dev/null 2>&1; then \
		echo "Generating vmlinux.h..."; \
		$(BPFTOOL) btf dump file /sys/kernel/btf/vmlinux format c > vmlinux.h; \
	else \
		echo "Warning: bpftool not found, skipping vmlinux.h generation"; \
	fi

# Clean build artifacts
clean:
	rm -f $(BPF_OBJ) vmlinux.h

# Install target (optional)
install: $(BPF_OBJ)
	@echo "Installing eBPF program..."
	install -d $(DESTDIR)/usr/lib/ai-guardian
	install -m 644 $(BPF_OBJ) $(DESTDIR)/usr/lib/ai-guardian/

# Debug target to show build info
info:
	@echo "Architecture: $(ARCH)"
	@echo "Kernel release: $(KERNEL_RELEASE)"
	@echo "Clang version: $(shell $(CLANG) --version | head -1)"
	@echo "BPF source: $(BPF_SRC)"
	@echo "BPF object: $(BPF_OBJ)"
	@echo "Kernel headers: $(LINUX_HEADERS)"
	@echo "Basic headers: $(KERNEL_HEADERS)"
