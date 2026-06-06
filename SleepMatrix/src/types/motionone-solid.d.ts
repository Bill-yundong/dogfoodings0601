declare module '@motionone/solid' {
  import { Component, JSX } from 'solid-js';

  interface MotionProps extends JSX.HTMLAttributes<HTMLElement> {
    initial?: any;
    animate?: any;
    transition?: any;
    exit?: any;
    whileHover?: any;
    whileTap?: any;
    whileFocus?: any;
    whileInView?: any;
    viewport?: any;
    variants?: any;
    custom?: any;
    inherit?: boolean;
    mode?: string;
    preserveOpacity?: boolean;
  }

  type MotionComponent = Component<MotionProps>;

  interface MotionComponents {
    div: MotionComponent;
    span: MotionComponent;
    p: MotionComponent;
    h1: MotionComponent;
    h2: MotionComponent;
    h3: MotionComponent;
    h4: MotionComponent;
    h5: MotionComponent;
    h6: MotionComponent;
    button: MotionComponent;
    a: MotionComponent;
    img: MotionComponent;
    ul: MotionComponent;
    ol: MotionComponent;
    li: MotionComponent;
    tr: MotionComponent;
    td: MotionComponent;
    th: MotionComponent;
    [key: string]: MotionComponent;
  }

  export const Motion: MotionComponents;
  export const Presence: Component<{ children: any; mode?: string }>;
  export const AnimatePresence: Component<{ children: any; mode?: string }>;
  export const LazyMotion: Component<{ children: any; loadFeatures: () => Promise<any> }>;
  export const domAnimation: any;
  export const domMax: any;
}
