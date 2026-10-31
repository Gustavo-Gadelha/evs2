"use client";

import { useCombobox } from "downshift";
import { useDeferredValue, type Ref } from "react";

import { Input } from "@/components/ui/input";
import type { DictionaryEntry } from "@/lib/types";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  // Sugestões para o texto digitado (já limitadas); texto livre continua valendo.
  getItems: (query: string) => DictionaryEntry[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  inputRef?: Ref<HTMLInputElement>;
};

// Campo de texto com sugestões do dicionário. No lugar do <datalist> nativo, que renderiza todas as
// correspondências: aqui só o menu aberto existe, e com poucos itens.
export function Combobox({ label, value, onChange, getItems, placeholder, className = "", inputClassName = "", inputRef }: Props) {
  const query = useDeferredValue(value);
  const items = getItems(query);
  const { isOpen, getInputProps, getMenuProps, getItemProps, highlightedIndex } = useCombobox<DictionaryEntry>({
    items,
    inputValue: value,
    itemToString: (item) => item?.name ?? "",
    selectedItem: null,
    onSelectedItemChange: ({ selectedItem }) => {
      if (selectedItem) onChange(selectedItem.name);
    },
  });

  return (
    <div className={`relative ${className}`}>
      <Input
        {...getInputProps({
          ref: inputRef,
          "aria-label": label,
          spellCheck: false,
          placeholder,
          className: inputClassName,
          onChange: (event) => onChange((event.target as HTMLInputElement).value),
        })}
      />
      <ul
        {...getMenuProps()}
        className={`absolute left-0 top-full z-20 mt-1 max-h-64 w-max min-w-full max-w-xl overflow-auto rounded-lg border bg-popover p-1 text-xs text-popover-foreground shadow-md ${
          isOpen && items.length > 0 ? "" : "hidden"
        }`}
      >
        {isOpen &&
          items.map((item, index) => (
            <li
              key={item.name}
              {...getItemProps({ item, index })}
              className={`flex flex-col px-2 py-1 ${highlightedIndex === index ? "bg-accent text-accent-foreground" : ""}`}
            >
              <span className="font-mono">{item.name}</span>
              {item.description && <span className="text-muted-foreground">{item.description}</span>}
            </li>
          ))}
      </ul>
    </div>
  );
}
