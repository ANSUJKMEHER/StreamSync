import { useState } from 'react';
import { MdSearch, MdClose } from 'react-icons/md';
import { useFileStore } from '../../store/fileStore';
import type { FileItem } from '../../types';

interface SearchResult {
  file: FileItem;
  matches: { lineNumber: number; lineContent: string }[];
}

export default function SearchPanel() {
  const [query, setQuery] = useState('');
  const files = useFileStore(state => state.files);
  const revealLine = useFileStore(state => state.revealLine);

  // Search across all text files (excluding folders)
  const getSearchResults = (): SearchResult[] => {
    if (!query.trim() || query.length < 2) return [];

    const results: SearchResult[] = [];
    const searchRegex = new RegExp(query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');

    files.forEach(file => {
      if (file.isFolder || !file.content) return;

      const lines = file.content.split('\n');
      const matches: { lineNumber: number; lineContent: string }[] = [];

      lines.forEach((line, index) => {
        if (searchRegex.test(line)) {
          matches.push({
            lineNumber: index + 1,
            lineContent: line.trim()
          });
        }
      });

      if (matches.length > 0) {
        results.push({
          file,
          matches
        });
      }
    });

    return results;
  };

  const results = getSearchResults();

  return (
    <div className="flex flex-col h-full bg-surface-container-low text-on-surface font-sans">
      {/* Title */}
      <div className="p-4 border-b border-outline-variant/15 flex justify-between items-center shrink-0">
        <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Search in Workspace</h2>
      </div>

      {/* Search Input */}
      <div className="p-3 shrink-0 flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-surface-container border border-outline-variant/15 rounded-xl px-3 py-1.5 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all relative">
          <MdSearch size={16} className="text-on-surface-variant/75" />
          <input
            type="text"
            placeholder="Search code..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-on-surface w-full placeholder-on-surface-variant/25 text-xs font-code"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="absolute right-3 text-on-surface-variant hover:text-white"
            >
              <MdClose size={14} />
            </button>
          )}
        </div>
        {query && query.length >= 2 && (
          <div className="text-[10px] text-on-surface-variant/60 px-1">
            Found {results.reduce((acc, curr) => acc + curr.matches.length, 0)} results in {results.length} files
          </div>
        )}
      </div>

      {/* Search Results List */}
      <div className="flex-grow overflow-y-auto no-scrollbar px-3 pb-4 flex flex-col gap-4">
        {results.map(({ file, matches }) => (
          <div key={file.id} className="flex flex-col gap-1">
            {/* File Header */}
            <div className="text-xs font-semibold text-on-surface truncate px-1 py-0.5 border-b border-outline-variant/10">
              {file.name}
            </div>
            {/* Matches */}
            <div className="flex flex-col gap-1 mt-1">
              {matches.map(({ lineNumber, lineContent }) => (
                <button
                  key={`${file.id}-${lineNumber}`}
                  onClick={() => revealLine(file.id, lineNumber)}
                  className="flex text-left w-full p-2 bg-surface hover:bg-surface-container-high border border-outline-variant/10 rounded-lg text-[11px] font-code hover:border-primary/30 transition-all group"
                >
                  <span className="text-primary/75 group-hover:text-primary font-bold w-7 shrink-0">{lineNumber}</span>
                  <span className="text-on-surface-variant group-hover:text-on-surface truncate flex-grow leading-relaxed">{lineContent || <span className="italic text-on-surface-variant/30">empty line</span>}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {query && query.length >= 2 && results.length === 0 && (
          <div className="text-center text-xs text-on-surface-variant/50 py-8">
            No matches found for "{query}"
          </div>
        )}

        {(!query || query.length < 2) && (
          <div className="text-center text-xs text-on-surface-variant/50 py-8 px-4 leading-relaxed">
            Type at least 2 characters to search across all files in the room.
          </div>
        )}
      </div>
    </div>
  );
}
