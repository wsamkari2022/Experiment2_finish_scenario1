/**
 * CountryField — the country question on "A little about you" (since 30 September 2026, the researcher's request:
 * "a drop list of the country with ability to write some letters and the list will try to match what the user
 * wrote ... smart and elegant").
 *
 * One box: type a few letters and the list narrows as you type, best matches first (countries.ts, matchCountries):
 * "Sa" shows every name starting with Sa, then names with a word starting with Sa (El Salvador), and other names work
 * too ("UK", "USA", "KSA", "Holland"). The typed letters are shown in bold inside each name, each row carries its
 * two-letter code, and the first match is highlighted so Enter picks it. Arrow keys, Enter, Escape and screen
 * readers work (Chakra's Combobox). Only a country from the list, or "Prefer not to say" (always last), can be chosen.
 */

import { useMemo, useState } from "react";
import { Box, Combobox, HStack, Icon, Portal, Text, createListCollection } from "@chakra-ui/react";
import { LuGlobe, LuMinus } from "react-icons/lu";
import {
  PREFER_NOT_TO_SAY, PREFER_NOT_TO_SAY_VALUE, countryByCode, matchCountries, type CountryMatch,
} from "./countries";

/** What the page keeps: a country's code and name, or "Prefer not to say" (code null). */
export interface CountryValue {
  code: string | null;
  name: string;
}

interface Item {
  value: string;
  label: string;
  match: CountryMatch | null;
}

/** The name with the typed part in bold. */
function Highlighted({ text, span }: { text: string; span: [number, number] | null }) {
  if (!span) return <>{text}</>;
  const [s, e] = span;
  return (
    <>
      {text.slice(0, s)}
      <Text as="span" fontWeight="bold" color="fg">{text.slice(s, e)}</Text>
      {text.slice(e)}
    </>
  );
}

export function CountryField({ value, onChange, onBlur, invalid }: {
  value: CountryValue | null;
  onChange: (value: CountryValue | null) => void;
  onBlur?: () => void;
  invalid?: boolean;
}) {
  /* What the participant is typing. Reset when a country is picked, so the list opens whole again next time. */
  const [query, setQuery] = useState("");

  const items: Item[] = useMemo(() => [
    ...matchCountries(query).map((m) => ({ value: m.country.code, label: m.country.name, match: m })),
    { value: PREFER_NOT_TO_SAY_VALUE, label: PREFER_NOT_TO_SAY, match: null },
  ], [query]);

  const collection = useMemo(() => createListCollection<Item>({
    items,
    itemToString: (item) => item.label,
    itemToValue: (item) => item.value,
  }), [items]);

  const selected = value ? [value.code ?? PREFER_NOT_TO_SAY_VALUE] : [];

  return (
    <Combobox.Root
      collection={collection}
      value={selected}
      onValueChange={(details) => {
        const code = details.value[0];
        if (!code) { onChange(null); return; }
        onChange(code === PREFER_NOT_TO_SAY_VALUE
          ? { code: null, name: PREFER_NOT_TO_SAY }
          : { code, name: countryByCode(code)?.name ?? code });
        setQuery("");
      }}
      onInputValueChange={(details) => {
        /* Only what the participant types narrows the list; the name a pick writes into the box does not. */
        if (details.reason === undefined || details.reason === "input-change") setQuery(details.inputValue);
        else setQuery("");
      }}
      onOpenChange={(details) => { if (!details.open) setQuery(""); }}
      inputBehavior="autohighlight"
      selectionBehavior="replace"
      openOnClick
      invalid={invalid}
      size="lg"
      positioning={{ sameWidth: true, gutter: 6 }}
    >
      <Combobox.Control>
        <Box position="absolute" left="3" top="50%" transform="translateY(-50%)" pointerEvents="none"
          color="fg.subtle" display="flex" zIndex="1">
          <Icon boxSize="4"><LuGlobe /></Icon>
        </Box>
        <Combobox.Input placeholder="Start typing to search" ps="9" rounded="lg" color="fg" onBlur={onBlur}
          autoComplete="off" aria-label="Country" />
        <Combobox.IndicatorGroup>
          <Combobox.ClearTrigger />
          <Combobox.Trigger />
        </Combobox.IndicatorGroup>
      </Combobox.Control>
      <Portal>
        <Combobox.Positioner>
          {/* A solid background of its own: without it the page behind (the hint, the Start button) showed through. */}
          <Combobox.Content maxH="72" overflowY="auto" rounded="xl" shadow="lg" borderWidth="1px" borderColor="border" p="1.5"
            bg="bg.panel" zIndex="popover">
            {items.length === 1 && (
              <Text fontSize="xs" color="fg.muted" px="3" py="2">
                No country matches “{query}”. Try the first letters of its name.
              </Text>
            )}
            {items.map((item) => {
              const none = item.value === PREFER_NOT_TO_SAY_VALUE;
              return (
                <Combobox.Item key={item.value} item={item} rounded="lg" px="2.5" py="2" gap="3"
                  mt={none ? "1" : undefined} borderTopWidth={none && items.length > 1 ? "1px" : undefined}
                  borderColor="border.subtle" cursor="pointer"
                  _highlighted={{ bg: "green.subtle" }}>
                  <HStack gap="3" flex="1" minW="0">
                    <Box as="span" minW="8" textAlign="center" fontSize="2xs" fontWeight="bold" letterSpacing="wider"
                      color={none ? "fg.subtle" : "green.fg"} bg={none ? "bg.muted" : "green.subtle"} rounded="md" px="1.5" py="0.5"
                      fontFamily="mono">
                      {none ? <Icon boxSize="3"><LuMinus /></Icon> : item.value}
                    </Box>
                    <Text fontSize="sm" color={none ? "fg.muted" : "fg"} lineClamp={1}>
                      <Highlighted text={item.label} span={item.match?.highlight ?? null} />
                      {item.match?.viaAka && (
                        <Text as="span" color="fg.subtle" fontSize="xs"> · {item.match.viaAka}</Text>
                      )}
                    </Text>
                  </HStack>
                  <Combobox.ItemIndicator />
                </Combobox.Item>
              );
            })}
          </Combobox.Content>
        </Combobox.Positioner>
      </Portal>
    </Combobox.Root>
  );
}
