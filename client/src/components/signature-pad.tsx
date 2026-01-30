import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Check } from "lucide-react";

interface SignaturePadProps {
  width?: number;
  height?: number;
  penColor?: string;
  backgroundColor?: string;
  onSignatureChange?: (hasSignature: boolean) => void;
  disabled?: boolean;
  className?: string;
  clearButtonText?: string;
  signedText?: string;
}

export interface SignaturePadRef {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: (type?: string) => string;
  toBlob: (type?: string, quality?: number) => Promise<Blob | null>;
}

const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  (
    {
      width = 400,
      height = 150,
      penColor = "#000000",
      backgroundColor = "#ffffff",
      onSignatureChange,
      disabled = false,
      className = "",
      clearButtonText = "Effacer",
      signedText = "Signature capturée",
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);

    // Helper function to create transparent signature image
    const createTransparentSignature = (): string => {
      const canvas = canvasRef.current;
      if (!canvas) return "";
      
      const ctx = canvas.getContext("2d");
      if (!ctx) return "";
      
      // Get the image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Create a temporary canvas for transparent output
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return "";
      
      // Create new image data with transparent background
      const newImageData = tempCtx.createImageData(canvas.width, canvas.height);
      const newData = newImageData.data;
      
      // Process each pixel: if it's white or near-white, make it transparent
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Check if pixel is white or near-white (threshold 250)
        if (r > 250 && g > 250 && b > 250) {
          // Make transparent
          newData[i] = 0;
          newData[i + 1] = 0;
          newData[i + 2] = 0;
          newData[i + 3] = 0; // Alpha = 0 (fully transparent)
        } else {
          // Keep the original pixel
          newData[i] = r;
          newData[i + 1] = g;
          newData[i + 2] = b;
          newData[i + 3] = data[i + 3];
        }
      }
      
      tempCtx.putImageData(newImageData, 0, 0);
      return tempCanvas.toDataURL("image/png");
    };

    useImperativeHandle(ref, () => ({
      clear: () => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            setHasSignature(false);
            onSignatureChange?.(false);
          }
        }
      },
      isEmpty: () => !hasSignature,
      toDataURL: (type = "image/png") => {
        // Return transparent signature for PNG
        if (type === "image/png") {
          return createTransparentSignature();
        }
        const canvas = canvasRef.current;
        return canvas ? canvas.toDataURL(type) : "";
      },
      toBlob: (type = "image/png", quality = 1) => {
        return new Promise((resolve) => {
          // For PNG, create transparent version
          if (type === "image/png") {
            const dataUrl = createTransparentSignature();
            if (!dataUrl) {
              resolve(null);
              return;
            }
            // Convert data URL to blob
            fetch(dataUrl)
              .then(res => res.blob())
              .then(blob => resolve(blob))
              .catch(() => resolve(null));
            return;
          }
          
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.toBlob((blob) => resolve(blob), type, quality);
          } else {
            resolve(null);
          }
        });
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    }, [backgroundColor]);

    const getCoordinates = (
      e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      if ("touches" in e) {
        const touch = e.touches[0];
        return {
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY,
        };
      } else {
        return {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY,
        };
      }
    };

    const startDrawing = (
      e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
    ) => {
      if (disabled) return;
      e.preventDefault();
      const coords = getCoordinates(e);
      if (coords) {
        setIsDrawing(true);
        lastPointRef.current = coords;
      }
    };

    const draw = (
      e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
    ) => {
      if (!isDrawing || disabled) return;
      e.preventDefault();

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const coords = getCoordinates(e);

      if (ctx && coords && lastPointRef.current) {
        ctx.beginPath();
        ctx.strokeStyle = penColor;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
        lastPointRef.current = coords;

        if (!hasSignature) {
          setHasSignature(true);
          onSignatureChange?.(true);
        }
      }
    };

    const stopDrawing = () => {
      setIsDrawing(false);
      lastPointRef.current = null;
    };

    const handleClear = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          setHasSignature(false);
          onSignatureChange?.(false);
        }
      }
    };

    return (
      <div className={`space-y-2 ${className}`}>
        <div className="relative border-2 border-dashed border-muted-foreground/30 rounded-lg overflow-hidden bg-background">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="w-full touch-none cursor-crosshair"
            style={{ maxWidth: "100%", height: "auto", aspectRatio: `${width}/${height}` }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            data-testid="canvas-signature"
          />
          {!hasSignature && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-muted-foreground/50 text-sm flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                Signez ici / Sign here
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={disabled || !hasSignature}
            data-testid="button-clear-signature"
          >
            <Eraser className="w-4 h-4 mr-2" />
            {clearButtonText}
          </Button>
          {hasSignature && (
            <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <Check className="w-4 h-4" />
              {signedText}
            </div>
          )}
        </div>
      </div>
    );
  }
);

SignaturePad.displayName = "SignaturePad";

export default SignaturePad;
