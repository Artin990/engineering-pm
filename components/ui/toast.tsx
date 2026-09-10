"use client";

import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between gap-[12px] overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-[16px] pe-[30px] text-[14px] font-medium text-[var(--text-primary)] shadow-[rgba(0,0,0,0.15)_0_1px_5px_0,rgba(0,0,0,0.1)_0_0_1px_1px] transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border-[var(--border)] bg-[var(--surface)]",
        destructive:
          "group border-[#dc2626] bg-[#dc2626] text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

type ToastProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
  VariantProps<typeof toastVariants>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  ToastProps
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-[10px] border border-[var(--border)] bg-transparent px-[14px] text-[14px] font-semibold transition-[0.15s_ease-in-out] hover:bg-[var(--surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-white/40 group-[.destructive]:hover:bg-white/20 group-[.destructive]:focus-visible:ring-white",
      className
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute end-[8px] top-[8px] rounded-[10px] p-[4px] text-[var(--text-muted)] opacity-0 transition-[0.15s_ease-in-out] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] group-hover:opacity-100 group-[.destructive]:text-white group-[.destructive]:hover:bg-white/20 group-[.destructive]:hover:text-white",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="size-4" />
    <span className="sr-only">بستن</span>
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-[14px] font-semibold tracking-[0]", className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-[14px] font-medium opacity-90", className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 5000;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ToastState = {
  toasts: ToasterToast[];
};

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function addToRemoveQueue(toastId: string) {
  if (toastTimeouts.has(toastId)) return;

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
}

type ActionMap = {
  ADD_TOAST: { toast: ToasterToast };
  UPDATE_TOAST: { toast: Partial<ToasterToast> };
  DISMISS_TOAST: { toastId?: ToasterToast["id"] };
  REMOVE_TOAST: { toastId?: ToasterToast["id"] };
};

type Action = { [K in keyof ActionMap]: { type: K } & ActionMap[K] }[keyof ActionMap];

const reducers: {
  [K in keyof ActionMap]: (
    state: ToastState,
    action: { type: K } & ActionMap[K]
  ) => ToastState;
} = {
  ADD_TOAST: (state, action) => {
    return {
      ...state,
      toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
    };
  },
  UPDATE_TOAST: (state, action) => {
    return {
      ...state,
      toasts: state.toasts.map((t) =>
        t.id === action.toast.id ? { ...t, ...action.toast } : t
      ),
    };
  },
  DISMISS_TOAST: (state, action) => {
    const { toastId } = action;

    if (toastId) {
      addToRemoveQueue(toastId);
    } else {
      state.toasts.forEach((toast) => {
        addToRemoveQueue(toast.id);
      });
    }

    return {
      ...state,
      toasts: state.toasts.map((t) =>
        t.id === toastId || toastId === undefined
          ? { ...t, open: false }
          : t
      ),
    };
  },
  REMOVE_TOAST: (state, action) => {
    if (action.toastId === undefined) {
      return { ...state, toasts: [] };
    }
    return {
      ...state,
      toasts: state.toasts.filter((t) => t.id !== action.toastId),
    };
  },
};

function reducer(state: ToastState, action: Action): ToastState {
  switch (action.type) {
    case "ADD_TOAST":
      return reducers.ADD_TOAST(state, { type: "ADD_TOAST", toast: action.toast });
    case "UPDATE_TOAST":
      return reducers.UPDATE_TOAST(state, { type: "UPDATE_TOAST", toast: action.toast });
    case "DISMISS_TOAST":
      return reducers.DISMISS_TOAST(state, { type: "DISMISS_TOAST", toastId: action.toastId });
    case "REMOVE_TOAST":
      return reducers.REMOVE_TOAST(state, { type: "REMOVE_TOAST", toastId: action.toastId });
    default:
      return state;
  }
}

const listeners: Array<(state: ToastState) => void> = [];

let memoryState: ToastState = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => listener(memoryState));
}

type ToastInput = Omit<ToasterToast, "id">;

function toast({ ...props }: ToastInput) {
  const id = genId();

  const update = (props: UpdateToastInput) =>
    dispatch({ type: "UPDATE_TOAST", toast: { ...props, id } });
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open: boolean) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id,
    dismiss,
    update,
  };
}

type UpdateToastInput = Partial<ToasterToast>;

function useToast() {
  const [state, setState] = React.useState<ToastState>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}

function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-[4px]">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-[8px] p-[16px] sm:bottom-0 sm:end-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  Toaster,
  useToast,
  toast,
};
