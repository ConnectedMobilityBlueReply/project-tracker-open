"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "radix-ui"
import { X } from "@phosphor-icons/react"

import { hitBoxPositioned } from "@/lib/hit-area"
import { tv, type VariantProps } from "@/lib/tv"

/**
 * Sheet: pannello laterale modale, per creare o modificare un elemento senza lasciare la pagina.
 * Stesso primitivo Radix Dialog del `Dialog` (focus trap, scroll lock, uscita animata), ma ancorato
 * al bordo destro. Sotto `sm` occupa tutta la larghezza. Header e footer restano fermi, scorre solo
 * `SheetBody`. Per un form: `<form className="flex min-h-0 flex-1 flex-col">` con `SheetBody` +
 * `SheetFooter` dentro. Un Select o un popover aperto dentro il pannello gestisce Esc da solo.
 */
export const sheetVariants = tv({
  slots: {
    overlay: [
      "fixed inset-0 z-50 bg-black/50",
      "data-[state=open]:animate-in data-[state=open]:fade-in-0",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
      "duration-base ease-out",
    ],
    content: [
      "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border-soft bg-popover text-popover-foreground shadow-lg",
      "[--surface:var(--popover)] outline-none",
      "data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
      "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right",
      "duration-base ease-drawer",
    ],
    close: [
      "absolute top-4 right-4 inline-flex size-7 cursor-pointer items-center justify-center rounded-md",
      hitBoxPositioned,
      "text-muted-foreground transition-colors duration-fast ease-out",
      "hover:bg-accent hover:text-foreground active:scale-[0.96]",
      "outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    ],
    header: "flex flex-col gap-1 border-b border-border px-5 py-4 pr-12 text-left",
    body: "min-h-0 flex-1 overflow-y-auto px-5 py-4",
    footer: [
      "flex flex-col-reverse gap-2 border-t border-border px-5 pt-3 sm:flex-row sm:justify-end",
      "pb-[calc(var(--spacing)*3+env(safe-area-inset-bottom))]",
    ],
    title: "text-base leading-none font-semibold tracking-tight",
    description: "text-sm text-pretty text-muted-foreground",
  },
  variants: {
    size: {
      md: { content: "sm:max-w-[28rem]" },
      lg: { content: "sm:max-w-[36rem]" },
    },
  },
  defaultVariants: { size: "md" },
})

export const Sheet = SheetPrimitive.Root
export const SheetTrigger = SheetPrimitive.Trigger
export const SheetClose = SheetPrimitive.Close

export interface SheetContentProps
  extends React.ComponentProps<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /** Etichetta accessibile del pulsante di chiusura. */
  closeLabel?: string
}

export function SheetContent({
  className,
  children,
  size,
  closeLabel = "Chiudi",
  ...props
}: SheetContentProps) {
  const slots = sheetVariants({ size })
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay data-slot="sheet-overlay" className={slots.overlay()} />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={slots.content({ className })}
        {...props}
      >
        {children}
        <SheetPrimitive.Close aria-label={closeLabel} className={slots.close()}>
          <X weight="bold" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

export function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={sheetVariants().header({ className })} {...props} />
}

export function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-body" className={sheetVariants().body({ className })} {...props} />
}

export function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-footer" className={sheetVariants().footer({ className })} {...props} />
}

export function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title data-slot="sheet-title" className={sheetVariants().title({ className })} {...props} />
}

export function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={sheetVariants().description({ className })}
      {...props}
    />
  )
}
