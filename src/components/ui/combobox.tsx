
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxProps {
    options: { label: string; value: string }[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    noResultsMessage?: string;
    creatable?: boolean; triggerClassName?: string;
}

export function Combobox({ 
    options, 
    value, 
    onChange, 
    placeholder = "Select option...",
    searchPlaceholder = "Search...",
    noResultsMessage = "No results found.",
    creatable = false, triggerClassName
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")

  const handleSelect = (currentValue: string) => {
    const finalValue = currentValue === value ? "" : currentValue;
    onChange(finalValue);
    setOpen(false);
  };

  const handleCreate = () => {
    if (inputValue) {
      onChange(inputValue);
      setOpen(false);
    }
  };
  
  const currentSelection = options.find((option) => option.value.toLowerCase() === value?.toLowerCase())?.label ?? value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-auto min-h-9 py-2 text-left", triggerClassName)}
        >
          <span className="break-words">
            {value ? currentSelection : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command filter={(value, search) => {
          if (!search) return 1;
          const searchTerms = search.toLowerCase().split(' ').filter(Boolean);
          const lowerValue = value.toLowerCase();
          return searchTerms.every(term => lowerValue.includes(term)) ? 1 : 0;
        }}>
          <CommandInput 
            placeholder={searchPlaceholder}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
                {creatable && inputValue ? (
                    <div className="p-2">
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={handleCreate}
                        >
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create "{inputValue}"
                        </Button>
                    </div>
                ) : (
                    noResultsMessage
                )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const searchValue = `${option.label} ${option.value}`.toLowerCase();
                return (
                <CommandItem
                  key={option.value}
                  value={searchValue}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value && value.toLowerCase() === option.value.toLowerCase() ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              )})}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
