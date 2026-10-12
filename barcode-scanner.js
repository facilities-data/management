(() => {
    const modal = document.getElementById("barcode-scanner-modal");
    const video = document.getElementById("barcode-video");
    const status = document.getElementById("barcode-scan-status");
    const errorBox = document.getElementById("barcode-scan-error");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const enhancedCanvas = document.createElement("canvas");
    const enhancedContext = enhancedCanvas.getContext("2d", { willReadFrequently: true });

    let stream = null;
    let detector = null;
    let animationFrame = null;
    let scanTarget = "assets";
    let detecting = false;

    function setStatus(message, success = false) {
        if (status) {
            status.textContent = message;
            status.classList.toggle("is-success", success);
        }
    }

    function stopScanner() {
        if (animationFrame !== null) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }

        stream?.getTracks().forEach(track => track.stop());
        stream = null;
        detecting = false;

        if (video) {
            video.pause();
            video.srcObject = null;
        }
    }

    function closeScanner() {
        stopScanner();
        modal?.classList.remove("open");
    }

    function showDetectedCode(value) {
        const search = document.getElementById(
            scanTarget === "safety" ? "safety-equipment-search" : "asset-search"
        );

        if (search) {
            search.value = value;
            search.dispatchEvent(new Event("input", { bubbles: true }));
        }

        setStatus(`Barcode detected: ${value}`, true);
        stopScanner();
        modal?.classList.remove("open");

        // Open the record editor after the scanner has been removed from the
        // screen so the two dialogs cannot compete for visibility or focus.
        window.setTimeout(() => {
            const recordModalId = scanTarget === "safety"
                ? "safety-equipment-modal"
                : "asset-modal";
            const recordModal = document.getElementById(recordModalId);

            try {
                if (typeof window.openBarcodeRecord === "function") {
                    window.openBarcodeRecord(scanTarget, value);
                } else {
                    const tag = document.getElementById(
                        scanTarget === "safety" ? "safety-equipment-tag" : "asset-tag"
                    );
                    if (tag) tag.value = value;
                }
            } catch (openError) {
                console.error("Unable to open the barcode record:", openError);
            } finally {
                // Ensure a record form appears even if its app callback fails.
                recordModal?.classList.add("open");
            }
        }, 0);
    }

    async function scanFrame() {
        if (!stream || !detector || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            if (stream) {
                animationFrame = requestAnimationFrame(scanFrame);
            }
            return;
        }

        if (detecting) {
            animationFrame = requestAnimationFrame(scanFrame);
            return;
        }

        detecting = true;

        try {
            // Keep a wide quiet margin around linear labels such as Code 128.
            const sourceX = Math.round(video.videoWidth * 0.02);
            const sourceY = Math.round(video.videoHeight * 0.20);
            const sourceWidth = Math.round(video.videoWidth * 0.96);
            const sourceHeight = Math.round(video.videoHeight * 0.60);

            if (sourceWidth && sourceHeight) {
                canvas.width = sourceWidth;
                canvas.height = sourceHeight;
                context.drawImage(
                    video,
                    sourceX,
                    sourceY,
                    sourceWidth,
                    sourceHeight,
                    0,
                    0,
                    sourceWidth,
                    sourceHeight
                );

                let results = await detector.detect(canvas);
                let code = results.find(result => result.rawValue)?.rawValue;

                // A contrast-enhanced, enlarged pass helps with faint or slightly
                // soft printed labels without scanning outside the marked pane.
                if (!code) {
                    enhancedCanvas.width = sourceWidth * 2;
                    enhancedCanvas.height = sourceHeight * 2;
                    enhancedContext.filter = "grayscale(1) contrast(1.6) brightness(1.1)";
                    enhancedContext.drawImage(
                        canvas,
                        0,
                        0,
                        enhancedCanvas.width,
                        enhancedCanvas.height
                    );
                    enhancedContext.filter = "none";
                    results = await detector.detect(enhancedCanvas);
                    code = results.find(result => result.rawValue)?.rawValue;
                }

                if (code) {
                    showDetectedCode(code);
                    return;
                }
            }
        } catch (scanError) {
            console.warn("Barcode scan frame could not be decoded:", scanError);
        } finally {
            detecting = false;
        }

        if (stream) {
            setStatus("Scanning… keep the barcode inside the frame and hold steady.");
            animationFrame = requestAnimationFrame(scanFrame);
        }
    }

    async function startScanner(target) {
        scanTarget = target;
        stopScanner();
        if (!modal || !video) return;

        modal.classList.add("open");
        errorBox?.classList.remove("visible");
        if (errorBox) errorBox.textContent = "";
        setStatus("Starting camera…");

        if (!("BarcodeDetector" in window)) {
            setStatus("Barcode scanning is not supported by this browser.");
            if (errorBox) {
                errorBox.textContent = "Try a supported browser on a secure (HTTPS) page, or enter the barcode manually.";
                errorBox.classList.add("visible");
            }
            return;
        }

        try {
            const supported = typeof BarcodeDetector.getSupportedFormats === "function"
                ? await BarcodeDetector.getSupportedFormats()
                : [];
            const wanted = [
                "code_128", "code_39", "code_93", "codabar", "ean_13", "ean_8",
                "itf", "upc_a", "upc_e", "qr_code", "data_matrix", "pdf417", "aztec"
            ];
            const formats = supported.length
                ? wanted.filter(format => supported.includes(format))
                : undefined;

            detector = formats?.length
                ? new BarcodeDetector({ formats })
                : new BarcodeDetector();

            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: {
                        facingMode: { ideal: "environment" },
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    }
                });
            } catch (cameraError) {
                // Retry without ideal constraints for cameras with limited support.
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: { facingMode: "environment" }
                });
            }

            video.srcObject = stream;
            await video.play();

            const track = stream.getVideoTracks()[0];
            const capabilities = track?.getCapabilities?.();
            if (capabilities?.focusMode?.includes("continuous")) {
                track.applyConstraints({ advanced: [{ focusMode: "continuous" }] })
                    .catch(() => {});
            }

            setStatus("Scanning… keep the barcode inside the frame and hold steady.");
            animationFrame = requestAnimationFrame(scanFrame);
        } catch (cameraError) {
            console.error("Unable to start barcode scanner:", cameraError);
            stopScanner();
            setStatus("Camera could not be started.");

            if (errorBox) {
                const message = cameraError?.name === "NotAllowedError"
                    ? "Allow camera access in your browser settings, then try again."
                    : cameraError?.name === "NotFoundError"
                        ? "No camera was found on this device."
                        : "Check that camera access is available and the page is using HTTPS.";
                errorBox.textContent = message;
                errorBox.classList.add("visible");
            }
        }
    }

    document.addEventListener("click", event => {
        const assetButton = event.target.closest("#scan-asset-barcode");
        const safetyButton = event.target.closest("#scan-safety-barcode");
        const closeButton = event.target.closest("#close-barcode-scanner");

        if (assetButton || safetyButton) {
            event.preventDefault();
            event.stopImmediatePropagation();
            startScanner(safetyButton ? "safety" : "assets");
            return;
        }

        if (closeButton || event.target === modal) {
            event.preventDefault();
            event.stopImmediatePropagation();
            closeScanner();
        }
    }, true);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && modal?.classList.contains("open")) {
            closeScanner();
        }
    });
})();
