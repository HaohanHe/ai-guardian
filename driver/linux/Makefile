# AI Guardian Linux eBPF Makefile

CLANG ?= clang
LLC ?= llc
BPFTOOL ?= bpftool
ARCH ?= $(shell uname -m | sed 's/x86_64/x86/' | sed 's/aarch64/arm64/')

# eBPF program source and target
BPF_SRC := ai_guardian.bpf.c
BPF_OBJ := ai_guardian.bpf.o

# Kernel headers path
KERNEL_HEADERS := /usr/include
LINUX_HEADERS := /usr/src/linux-headers-$(shell uname -r)

# Compiler flags for eBPF
BPF_CFLAGS := -O2 -target bpf -D__TARGET_ARCH_$(ARCH) \
    -I$(KERNEL_HEADERS) \
    -I$(LINUX_HEADERS)/include \
    -I$(LINUX_HEADERS)/arch/$(ARCH)/include \
    -I$(LINUX_HEADERS)/tools/lib \
    -I/usr/include/bpf \
    -Wall -g

.PHONY: all clean vmlinux

all: $(BPF_OBJ)

# Compile eBPF program
$(BPF_OBJ): $(BPF_SRC)
	@echo "Compiling eBPF program: $<"
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
	@echo "Clang version: $(shell $(CLANG) --version | head -1)"
	@echo "BPF source: $(BPF_SRC)"
	@echo "BPF object: $(BPF_OBJ)"
	@echo "Kernel headers: $(LINUX_HEADERS)"
