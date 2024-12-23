import {
  LegacyStack,
  Tag,
  Listbox,
  EmptySearchResult,
  Combobox,
  Text,
  AutoSelection,
} from "@shopify/polaris";
import { useState, useCallback, useMemo } from "react";

interface MultiselectProps {
  availableTags: string[];
  selectedTags: string[];
  onTagSelect: (selectedTags: string[]) => void;
  onTagCreate?: (newTag: string) => void;
  placeholder?: string;
}

function Multiselect({
  availableTags,
  selectedTags: initialSelectedTags,
  onTagSelect,
  onTagCreate,
  placeholder = "Search tags",
}: MultiselectProps) {
  const [selectedTags, setSelectedTags] =
    useState<string[]>(initialSelectedTags);
  const [value, setValue] = useState("");
  const [suggestion, setSuggestion] = useState("");

  const handleActiveOptionChange = useCallback(
    (activeOption: string) => {
      const activeOptionIsAction = activeOption === value;

      if (!activeOptionIsAction && !selectedTags.includes(activeOption)) {
        setSuggestion(activeOption);
      } else {
        setSuggestion("");
      }
    },
    [value, selectedTags],
  );

  const updateSelection = useCallback(
    (selected: string) => {
      const nextSelectedTags = new Set([...selectedTags]);

      if (nextSelectedTags.has(selected)) {
        nextSelectedTags.delete(selected);
      } else {
        nextSelectedTags.add(selected);
      }

      const updatedTags = [...nextSelectedTags];
      setSelectedTags(updatedTags);
      onTagSelect(updatedTags); // Notify parent component
      setValue("");
      setSuggestion("");
    },
    [selectedTags, onTagSelect],
  );

  const removeTag = useCallback(
    (tag: string) => () => {
      updateSelection(tag);
    },
    [updateSelection],
  );

  const createNewTag = useCallback(() => {
    if (value.trim() && !availableTags.includes(value.trim())) {
      const newTag = value.trim();
      if (onTagCreate) {
        onTagCreate(newTag); // Notify parent component of new tag creation
      }

      updateSelection(newTag); // Add the new tag to the selected list
    }
    setValue("");
    setSuggestion("");
  }, [value, availableTags, onTagCreate, updateSelection]);

  const getAllTags = useCallback(() => {
    return [...new Set([...availableTags, ...selectedTags].sort())];
  }, [availableTags, selectedTags]);

  const formatOptionText = useCallback(
    (option: string) => {
      const trimValue = value?.trim()?.toLocaleLowerCase();
      const matchIndex = option?.toLocaleLowerCase().indexOf(trimValue);

      if (!value || matchIndex === -1) return option;

      const start = option.slice(0, matchIndex);
      const highlight = option.slice(matchIndex, matchIndex + trimValue.length);
      const end = option.slice(matchIndex + trimValue.length, option.length);

      return (
        <p>
          {start}
          <Text fontWeight="bold" as="span">
            {highlight}
          </Text>
          {end}
        </p>
      );
    },
    [value],
  );

  const escapeSpecialRegExCharacters = useCallback(
    (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    [],
  );

  const options = useMemo(() => {
    let list;
    const allTags = getAllTags();
    const filterRegex = new RegExp(escapeSpecialRegExCharacters(value), "i");

    if (value) {
      list = allTags.filter((tag) => tag.match(filterRegex));
    } else {
      list = allTags;
    }

    return [...list];
  }, [value, getAllTags, escapeSpecialRegExCharacters]);

  const verticalContentMarkup =
    selectedTags.length > 0 ? (
      <LegacyStack spacing="extraTight" alignment="center">
        {selectedTags.map((tag) => (
          <Tag key={`option-${tag}`} onRemove={removeTag(tag)}>
            {tag}
          </Tag>
        ))}
      </LegacyStack>
    ) : null;

  const optionMarkup =
    options.length > 0
      ? options.map((option) => {
          return (
            <Listbox.Option
              key={option}
              value={option}
              selected={selectedTags.includes(option)}
              accessibilityLabel={option}
            >
              <Listbox.TextOption selected={selectedTags.includes(option)}>
                {formatOptionText(option)}
              </Listbox.TextOption>
            </Listbox.Option>
          );
        })
      : null;

  const noResults = value && !getAllTags().includes(value);

  const actionMarkup = noResults ? (
    <Listbox.Action value={value} onAction={createNewTag}>
      {`Add "${value}"`}
    </Listbox.Action>
  ) : null;

  const emptyStateMarkup = optionMarkup ? null : (
    <EmptySearchResult
      title=""
      description={`No tags found matching "${value}"`}
    />
  );

  const listboxMarkup =
    optionMarkup || actionMarkup || emptyStateMarkup ? (
      <Listbox
        autoSelection={AutoSelection.None}
        onSelect={updateSelection}
        onActiveOptionChange={handleActiveOptionChange}
      >
        {actionMarkup}
        {optionMarkup}
      </Listbox>
    ) : null;

  return (
    <div
      style={{ maxWidth: "200px" }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <Combobox
        allowMultiple
        activator={
          <Combobox.TextField
            autoComplete="off"
            label="Search tags"
            labelHidden
            value={value}
            suggestion={suggestion}
            placeholder={placeholder}
            verticalContent={verticalContentMarkup}
            onChange={setValue}
          />
        }
      >
        {listboxMarkup}
      </Combobox>
    </div>
  );
}

export default Multiselect;
