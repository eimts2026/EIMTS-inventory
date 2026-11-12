import { Children, isValidElement, useRef, useState } from "react";
import type { ReactNode, ReactElement } from "react";
import * as Primitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

interface OptionProps {
  value?: string;
  children: ReactNode;
  disabled?: boolean;
}
interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  "aria-label"?: string;
}
const emptyValue = "__all__";

export function Select({
  value,
  onValueChange,
  children,
  required,
  disabled,
  name,
  "aria-label": label,
}: SelectProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [container, setContainer] = useState<HTMLElement>();
  const options = Children.toArray(children).filter(
    isValidElement,
  ) as ReactElement<OptionProps>[];
  const blank = options.find((option) => option.props.value === "");
  function optionValue(option: ReactElement<OptionProps>) {
    return option.props.value ?? String(option.props.children);
  }
  return (
    <Primitive.Root
      value={value || (required ? "" : emptyValue)}
      onValueChange={(next) => onValueChange(next === emptyValue ? "" : next)}
      required={required}
      disabled={disabled}
      name={name}
      onOpenChange={(open) => {
        if (open)
          setContainer(trigger.current?.closest("dialog") || document.body);
      }}
    >
      <Primitive.Trigger
        ref={trigger}
        className="select-trigger"
        aria-label={label}
      >
        <Primitive.Value
          placeholder={blank?.props.children || "Choose an option"}
        />
        <Primitive.Icon>
          <ChevronDown size={16} />
        </Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal container={container}>
        <Primitive.Content
          className="select-content"
          position="popper"
          sideOffset={6}
          collisionPadding={12}
        >
          <Primitive.ScrollUpButton className="select-scroll">
            <ChevronUp size={16} />
          </Primitive.ScrollUpButton>
          <Primitive.Viewport className="select-viewport">
            {options
              .filter((option) => !required || optionValue(option) !== "")
              .map((option) => (
                <Primitive.Item
                  className="select-option"
                  key={optionValue(option)}
                  value={optionValue(option) || emptyValue}
                  disabled={option.props.disabled}
                >
                  <Primitive.ItemText>
                    {option.props.children}
                  </Primitive.ItemText>
                  <Primitive.ItemIndicator>
                    <Check size={16} />
                  </Primitive.ItemIndicator>
                </Primitive.Item>
              ))}
          </Primitive.Viewport>
          <Primitive.ScrollDownButton className="select-scroll">
            <ChevronDown size={16} />
          </Primitive.ScrollDownButton>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
