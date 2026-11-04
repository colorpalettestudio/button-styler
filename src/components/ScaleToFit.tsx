import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export default function ScaleToFit({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ scale: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => {
      const width = inner.offsetWidth;
      const scale = width > 0 ? Math.min(1, outer.clientWidth / width) : 1;
      setFit({ scale, height: inner.offsetHeight * scale });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  const scaled = fit !== null && fit.scale < 1;
  return (
    <div className="scale-to-fit" ref={outerRef} style={scaled ? { height: fit.height } : undefined}>
      <div
        className="scale-to-fit__inner"
        ref={innerRef}
        style={scaled ? { transform: `scale(${fit.scale})` } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
