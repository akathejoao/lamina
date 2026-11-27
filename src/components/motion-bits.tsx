"use client";

import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { formatBRL } from "@/lib/money";
import { easeOut } from "@/lib/motion";

// Valor em reais que rola até o novo número (400ms) em vez de pular. Parado, mostra exatamente formatBRL(cents).
export function Rolling({ cents }: { cents: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(cents);
  const last = useRef(cents);
  useEffect(() => {
    if (reduce || last.current === cents) {
      last.current = cents;
      return;
    }
    const controls = animate(last.current, cents, {
      duration: 0.4,
      ease: easeOut,
      onUpdate: (value) => {
        last.current = value;
        setShown(Math.round(value));
      },
      onComplete: () => {
        last.current = cents;
        setShown(cents);
      },
    });
    return () => controls.stop();
  }, [cents, reduce]);
  return <>{formatBRL(reduce ? cents : shown)}</>;
}

// Barra que cresce por transform quando entra na tela e acompanha o valor quando ele muda.
export function GrowBar({ scale, className = "", style, delay = 0 }: { scale: number; className?: string; style?: CSSProperties; delay?: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -8% 0px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ ...style, transformOrigin: "left center" }}
      initial={reduce ? false : { scaleX: 0 }}
      animate={{ scaleX: reduce || seen ? Math.max(0, Math.min(1, scale)) : 0 }}
      transition={{ duration: reduce ? 0 : 0.6, delay: reduce ? 0 : delay, ease: easeOut }}
    />
  );
}

// Mensagem de erro de formulário: entra com fade e um tremor de 3px, uma vez. Sem movimento, só fade.
export function FormError({ children, role = "alert" }: { children: ReactNode; role?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.p
      role={role}
      className="text-sm text-coral"
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: 0 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, x: [0, -3, 3, -2, 0] }}
      transition={{ duration: reduce ? 0.12 : 0.3, ease: easeOut }}
    >
      {children}
    </motion.p>
  );
}

// Revela uma vez, ao rolar, o que começa abaixo da dobra. Nada é escondido sem JS: o ocultar é armado aqui, no cliente.
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.88) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(14px)";
    const show = () => {
      el.style.opacity = "";
      el.style.transform = "";
      el.animate(
        [
          { opacity: 0, transform: "translateY(14px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 420, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
      );
    };
    const io = new IntersectionObserver(
      (items) => {
        if (items.some((item) => item.isIntersecting)) {
          io.disconnect();
          show();
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      el.style.opacity = "";
      el.style.transform = "";
    };
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
