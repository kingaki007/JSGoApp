/** Lists scratchpad tabs in the explorer with optional add, rename, and close controls. */
import { useState } from 'react';
import type { Language } from '@code-editor/core';
import { maxTabNameLength, type ScratchTab } from './draftStorage';
import { tabTitle } from './useDrafts';

interface TabListProps {
  tabs: readonly ScratchTab[];
  activeId: string;
  /** Whether the account's plan allows creating, renaming, and closing tabs. */
  editable: boolean;
  /** False once the tab limit is reached. */
  canAdd: boolean;
  /** Whether an untitled tab's displayed name tracks its first code line. */
  titleFromCode: boolean;
  /** @param id Tab to show in the editor. */
  onSelect(id: string): void;
  /** @param language Language of the tab to create. */
  onAdd(language: Language): void;
  /** @param id Tab to remove along with its code. */
  onClose(id: string): void;
  /** @param id Tab to rename. @param name Requested display name. */
  onRename(id: string, name: string): void;
}

/**
 * Renders one selectable row per tab; double-clicking a name edits it in place.
 * @param props Tabs, the active tab, plan access, and tab lifecycle callbacks.
 */
export default function TabList({
  tabs,
  activeId,
  editable,
  canAdd,
  titleFromCode,
  onSelect,
  onAdd,
  onClose,
  onRename,
}: TabListProps) {
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  /** @param save Whether the edited name is applied or discarded. */
  function finishRename(save: boolean) {
    if (renaming && save) onRename(renaming.id, renaming.name);
    setRenaming(null);
  }

  return (
    <>
      <div className="explorer-root">
        <span aria-hidden="true">⌄</span> SCRATCHPADS
        {editable && (
          <span className="tab-add-actions">
            {(['javascript', 'typescript'] as const).map((language) => (
              <button
                key={language}
                type="button"
                className="tab-action"
                disabled={!canAdd}
                title={`New ${language === 'typescript' ? 'TypeScript' : 'JavaScript'} tab`}
                aria-label={`New ${language === 'typescript' ? 'TypeScript' : 'JavaScript'} tab`}
                onClick={() => onAdd(language)}
              >
                +{language === 'typescript' ? 'TS' : 'JS'}
              </button>
            ))}
          </span>
        )}
      </div>
      <nav aria-label="Select scratchpad">
        {tabs.map((tab) => {
          // The raw stored name is the fallback and the rename starting point; the displayed
          // title additionally tracks the first code line while the plan allows it and the tab
          // has not been explicitly renamed.
          const title = titleFromCode ? tabTitle(tab) : tab.name;
          return (
            <div className="file-row" key={tab.id}>
              {renaming?.id === tab.id ? (
                <input
                  className="tab-rename"
                  aria-label={`Rename ${title}`}
                  autoFocus
                  maxLength={maxTabNameLength}
                  value={renaming.name}
                  onChange={(event) => setRenaming({ id: tab.id, name: event.target.value })}
                  onFocus={(event) => event.target.select()}
                  onBlur={() => finishRename(true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') finishRename(true);
                    else if (event.key === 'Escape') finishRename(false);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={`file-button ${activeId === tab.id ? 'selected' : ''}`}
                  aria-pressed={activeId === tab.id}
                  title={editable ? 'Double-click to rename' : undefined}
                  onClick={() => onSelect(tab.id)}
                  onDoubleClick={() => {
                    if (editable) setRenaming({ id: tab.id, name: title });
                  }}
                >
                  <span className={`language-badge ${tab.language}`} aria-hidden="true">
                    {tab.language === 'typescript' ? 'TS' : 'JS'}
                  </span>
                  <span className="file-name">{title}</span>
                </button>
              )}
              {editable && tabs.length > 1 && renaming?.id !== tab.id && (
                <button
                  type="button"
                  className="tab-action tab-close"
                  aria-label={`Close ${title}`}
                  title="Close tab"
                  onClick={() => onClose(tab.id)}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </nav>
    </>
  );
}
