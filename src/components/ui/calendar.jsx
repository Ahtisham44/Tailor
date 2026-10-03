import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, getDefaultClassNames } from "react-day-picker"
import "react-day-picker/style.css"
import { cn } from "@/lib/utils"

function Calendar({ className, classNames, components, ...props }) {
  const defaults = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays
      className={cn("order-calendar", className)}
      classNames={{
        ...defaults,
        months: cn(defaults.months, "order-calendar-months"),
        month: cn(defaults.month, "order-calendar-month"),
        month_caption: cn(defaults.month_caption, "order-calendar-caption"),
        nav: cn(defaults.nav, "order-calendar-nav"),
        month_grid: cn(defaults.month_grid, "order-calendar-grid"),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName, ...chevronProps }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight
          return <Icon className={cn("h-4 w-4", chevronClassName)} {...chevronProps} />
        },
        ...components,
      }}
      {...props}
    />
  )
}

export { Calendar }
