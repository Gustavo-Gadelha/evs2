"use client";

import { useCombobox } from "downshift";
import { useDeferredValue, type Ref } from "react";

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
      <input
        {...getInputProps({
          ref: inputRef,
          "aria-label": label,
          spellCheck: false,
          placeholder,
          className: `input w-full ${inputClassName}`,
          onChange: (event) => onChange((event.target as HTMLInputElement).value),
        })}
      />
      <ul
        {...getMenuProps()}
        className={`panel absolute left-0 top-full z-20 mt-1 max-h-64 min-w-full w-max max-w-xl overflow-auto text-xs ${
          isOpen && items.length > 0 ? "" : "hidden"
        }`}
      >
        {isOpen &&
          items.map((item, index) => (
            <li
              key={item.name}
              {...getItemProps({ item, index })}
              className={`flex flex-col px-2 py-1 ${highlightedIndex === index ? "bg-zinc-800" : ""}`}
            >
              <span className="font-mono text-zinc-100">{item.name}</span>
              {item.description && <span className="text-zinc-500">{item.description}</span>}
            </li>
          ))}
      </ul>
    </div>
  );
}
