import {
  forwardRef,
  useCallback,
  useId,
  useState,
} from "react";

import { LayoutGroup, motion } from "framer-motion";

import { Check } from "lucide-react";

import type {
  ButtonHTMLAttributes,
  ComponentType,
  HTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type NotchPosition = "top" | "bottom";

export interface NotchItemData {
  id: string;
  label: string;
  icon?: LucideIcon | ComponentType<{ className?: string }>;
  badge?: string;
  disabled?: boolean;
}

export interface NotchWingProps {
  position?: NotchPosition;
  className?: string;
}

export function NotchLeftWing({
  position = "top",
  className,
}: NotchWingProps) {
  const isBottom = position === "bottom";

  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      shapeRendering="geometricPrecision"
      className={cn(
        "pointer-events-none absolute right-full size-2.5 md:size-4 overflow-visible select-none text-[#08090c] transition-colors duration-200",
        isBottom ? "bottom-0" : "top-0",
        className
      )}
    >
      <path
        d={
          isBottom
            ? "M 0 20 C 11.046 20 20 11.046 20 0 H 21 V 21 H 0 Z"
            : "M 0 0 C 11.046 0 20 8.954 20 20 H 21 V -1 H 0 Z"
        }
        fill="currentColor"
      />
    </svg>
  );
}

export function NotchRightWing({
  position = "top",
  className,
}: NotchWingProps) {
  const isBottom = position === "bottom";

  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      shapeRendering="geometricPrecision"
      className={cn(
        "pointer-events-none absolute left-full size-2.5 md:size-4 overflow-visible select-none text-[#08090c] transition-colors duration-200",
        isBottom ? "bottom-0" : "top-0",
        className
      )}
    >
      <path
        d={
          isBottom
            ? "M 20 20 C 8.954 20 0 11.046 0 0 H -1 V 21 H 20 Z"
            : "M 20 0 C 8.954 0 0 8.954 0 20 H -1 V -1 H 20 Z"
        }
        fill="currentColor"
      />
    </svg>
  );
}

export function NotchCornerLeftWing({
  position = "top",
  className,
}: NotchWingProps) {
  const isBottom = position === "bottom";

  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      shapeRendering="geometricPrecision"
      className={cn(
        "pointer-events-none absolute left-0 size-2.5 md:size-4 overflow-visible select-none text-[#08090c] transition-colors duration-200",
        isBottom ? "bottom-full" : "top-full",
        className
      )}
    >
      <path
        d={
          isBottom
            ? "M 0 20 H 20 C 8.954 20 0 11.046 0 0 V 20 Z"
            : "M 0 0 H 20 C 8.954 0 0 8.954 0 20 V 0 Z"
        }
        fill="currentColor"
      />
    </svg>
  );
}

export function NotchCornerRightWing({
  position = "top",
  className,
}: NotchWingProps) {
  const isBottom = position === "bottom";

  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      shapeRendering="geometricPrecision"
      className={cn(
        "pointer-events-none absolute right-0 size-2.5 md:size-4 overflow-visible select-none text-[#08090c] transition-colors duration-200",
        isBottom ? "bottom-full" : "top-full",
        className
      )}
    >
      <path
        d={
          isBottom
            ? "M 20 20 H 0 C 11.046 20 20 11.046 20 0 V 20 Z"
            : "M 20 0 H 0 C 11.046 0 20 8.954 20 20 V 0 Z"
        }
        fill="currentColor"
      />
    </svg>
  );
}

export interface NotchItemProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onSelect"> {
  id: string;
  label: string;
  isActive: boolean;
  icon?: LucideIcon | ComponentType<{ className?: string }>;
  badge?: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
}

export const NotchItem = forwardRef<HTMLButtonElement, NotchItemProps>(
  (
    {
      id,
      label,
      isActive,
      icon: Icon,
      badge,
      disabled,
      className,
      onClick,
      onSelect,
      ...props
    },
    ref
  ) => {
    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
      if (disabled) {
        event.preventDefault();
        return;
      }

      onSelect(id);
      onClick?.(event);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!disabled) {
          onSelect(id);
        }
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative flex h-8.5 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors outline-none select-none",
          "focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1 dark:focus-visible:ring-zinc-500",
          isActive
            ? "font-semibold text-zinc-50"
            : "text-zinc-400 hover:text-zinc-200",
          disabled && "cursor-not-allowed pointer-events-none opacity-40",
          className
        )}
        {...props}
      >
        {isActive && (
          <motion.span
            layoutId="notch-active-pill"
            className="absolute inset-0 rounded-full bg-white/15 border border-white/20 shadow-sm"
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
            }}
          />
        )}

        <span className="relative z-10 flex items-center gap-1.5">
          {Icon && (
            <Icon
              className={cn(
                "size-3.5 shrink-0 transition-colors",
                isActive
                  ? "text-zinc-50"
                  : "text-zinc-400 group-hover:text-zinc-200"
              )}
            />
          )}

          <span className="leading-none">{label}</span>

          {badge && (
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-tight text-zinc-300">
              {badge}
            </span>
          )}
        </span>
      </button>
    );
  }
);

NotchItem.displayName = "NotchItem";

interface NotchDropdownItemProps {
  item: NotchItemData;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function NotchDropdownItem({
  item,
  isSelected,
  onSelect,
}: NotchDropdownItemProps) {
  const Icon = item.icon;

  const handleClick = () => {
    onSelect(item.id);
  };

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      disabled={item.disabled}
      onClick={handleClick}
      className={cn(
        "flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left text-sm outline-none transition-colors select-none",
        "focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500",
        isSelected
          ? "bg-zinc-800 font-semibold text-zinc-50 dark:bg-zinc-300 dark:text-zinc-950"
          : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 active:bg-zinc-800 dark:text-zinc-600 dark:hover:bg-zinc-300/60 dark:hover:text-zinc-950 dark:active:bg-zinc-300",
        item.disabled && "cursor-not-allowed pointer-events-none opacity-40"
      )}
    >
      <div className="flex items-center gap-2.5">
        {Icon && (
          <Icon
            className={cn(
              "size-4 shrink-0",
              isSelected
                ? "text-zinc-50 dark:text-zinc-950"
                : "text-zinc-400 dark:text-zinc-600"
            )}
          />
        )}

        <span>{item.label}</span>
      </div>

      {isSelected && (
        <Check className="size-3.5 text-zinc-50 dark:text-zinc-950" />
      )}
    </button>
  );
}

export interface NotchNavProps extends HTMLAttributes<HTMLDivElement> {
  items: NotchItemData[];
  activeId?: string;
  defaultActiveId?: string;
  position?: NotchPosition;
  logo?: ReactNode;
  rightContent?: ReactNode;
  showLogo?: boolean;
  showRightContent?: boolean;
  children?: ReactNode;
  onActiveChange?: (id: string) => void;
}

export function NotchNav({
  items,
  activeId: controlledActiveId,
  defaultActiveId,
  position = "top",
  logo,
  rightContent,
  showLogo = true,
  showRightContent = true,
  children,
  onActiveChange,
  className,
  ...props
}: NotchNavProps) {
  const layoutGroupId = useId();

  const [internalActiveId, setInternalActiveId] = useState<string>(
    defaultActiveId || items[0]?.id || ""
  );

  const isBottom = position === "bottom";

  const activeId =
    controlledActiveId !== undefined
      ? controlledActiveId
      : internalActiveId;

  const handleSelect = useCallback(
    (id: string) => {
      if (controlledActiveId === undefined) {
        setInternalActiveId(id);
      }
      onActiveChange?.(id);
    },
    [controlledActiveId, onActiveChange]
  );

  return (
    <div
      className={cn(
        "relative w-full h-full flex flex-col justify-between text-zinc-50 select-none",
        className
      )}
      {...props}
    >
      {/* Notch Header Bar with Apple Concave Wings */}
      <header
        role="tablist"
        aria-orientation="horizontal"
        className={cn(
          "relative z-50 flex h-11 items-center justify-between px-4 bg-[#08090c] text-zinc-50 border-x border-b border-white/10 select-none transition-colors duration-200",
          isBottom ? "rounded-t-[24px]" : "rounded-b-[24px]"
        )}
      >
        <NotchLeftWing position={position} />
        <NotchRightWing position={position} />

        {/* Left side: Logo or brand slot */}
        {showLogo && logo && (
          <div className="flex shrink-0 items-center text-zinc-50">
            {logo}
          </div>
        )}

        {/* Center: Tabs with animated spring pill */}
        <LayoutGroup id={layoutGroupId}>
          <div className="flex items-center gap-1">
            {items.map((item) => (
              <NotchItem
                key={item.id}
                id={item.id}
                label={item.label}
                icon={item.icon}
                badge={item.badge}
                disabled={item.disabled}
                isActive={item.id === activeId}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </LayoutGroup>

        {/* Right side: Actions slot */}
        {showRightContent && rightContent && (
          <div className="flex shrink-0 items-center gap-1.5 text-zinc-50">
            {rightContent}
          </div>
        )}
      </header>

      {/* Children content */}
      <div className="relative flex-1 w-full overflow-hidden">
        {children}
      </div>
    </div>
  );
}
