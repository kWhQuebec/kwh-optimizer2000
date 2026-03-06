import { motion } from "framer-motion";
import { ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  direction?: "up" | "left" | "right";
  delay?: number;
  duration?: number;
  className?: string;
}

const directionMap = {
  up: { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 } },
  left: { initial: { opacity: 0, x: -30 }, animate: { opacity: 1, x: 0 } },
  right: { initial: { opacity: 0, x: 30 }, animate: { opacity: 1, x: 0 } },
};

export function ScrollReveal({
  children,
  direction = "up",
  delay = 0,
  duration = 0.5,
  className,
}: ScrollRevealProps) {
  const { initial, animate } = directionMap[direction];

  return (
    <motion.div
      initial={initial}
      whileInView={animate}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
