import React, { useState, useMemo, useEffect } from "react";
import { marked } from "marked";
import type { Memory } from "../lib/api";

const TYPE_COLORS: Record<string, string> = {
  user: "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  feedback: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  project: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  reference: "bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
};

interface Props {
  memory: Memory;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: { name?: string; body?: string; description?: string; tags?: string[] }) => void;
  onTagClick?: (tag: string) => void;
}

export function MemoryDetail({ memory, onDelete, onUpdate, onTagClick }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(memory.name);
  const [body, setBody] = useState(memory.body);
  const [description, setDescription] = useState(memory.description ?? "");

  // Reset form when memory changes
  useEffect(() => {
    setEditing(false);
    setName(memory.name);
    setBody(memory.body);
    setDescription(memory.description ?? "");
  }, [memory.id]);

  const renderedBody = useMemo(() => {
    return marked.parse(memory.body, { async: false }) as string;
  }, [memory.body]);

  const handleSave = () => {
    onUpdate(memory.id, {
      name: name !== memory.name ? name : undefined,
      body: body !== memory.body ? body : undefined,
      description: description !== (memory.description ?? "") ? description : undefined,
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setName(memory.name);
    setBody(memory.body);
    setDescription(memory.description ?? "");
    setEditing(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Title + actions */}
      <div className="shrink-0 flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xl font-semibold bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md px-3 py-1.5 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-[#7B7FBF]"
              />
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="One-line description..."
                className="w-full text-sm bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md px-3 py-1.5 text-stone-600 dark:text-stone-300 focus:outline-none focus:border-[#7B7FBF]"
              />
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100">{memory.name}</h2>
              {memory.description && (
                <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">{memory.description}</p>
              )}
            </>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {editing ? (
            <>
              <button
                onClick={handleCancel}
                className="text-sm px-3 py-1.5 border border-stone-200 dark:border-stone-700 rounded-md text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="text-sm px-3 py-1.5 bg-[#7B7FBF] text-white rounded-md hover:bg-[#6A6EAE] transition-colors"
              >
                Save
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="text-sm px-3 py-1.5 border border-stone-200 dark:border-stone-700 rounded-md text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(memory.id)}
                className="text-sm px-3 py-1.5 border border-red-200 dark:border-red-800 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Metadata row */}
      <div className="shrink-0 flex flex-wrap items-center gap-3 mb-4 text-sm">
        <span className={`px-2 py-0.5 rounded-full border font-medium text-xs ${TYPE_COLORS[memory.type] ?? ""}`}>
          {memory.type}
        </span>
        <span className="text-stone-400 dark:text-stone-500 font-mono text-xs">{memory.id}</span>
        {memory.profile && (
          <span className="text-stone-400 dark:text-stone-500 font-mono text-xs">{memory.profile}</span>
        )}
        <span className="text-stone-400 dark:text-stone-500 text-xs">
          importance: {memory.importance}
        </span>
        <span className="text-stone-400 dark:text-stone-500 text-xs">
          updated: {new Date(memory.updated_at).toLocaleDateString()}
        </span>
      </div>

      {/* Tags */}
      {memory.tags.length > 0 && (
        <div className="shrink-0 flex gap-1.5 mb-5">
          {memory.tags.map((tag) => (
            <button
              key={tag}
              onClick={() => onTagClick?.(tag)}
              className="text-xs px-2 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 rounded-full hover:bg-[#7B7FBF]/10 hover:text-[#7B7FBF] transition-colors cursor-pointer"
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col border-t border-stone-200 dark:border-stone-800 pt-5">
        {editing ? (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="flex-1 min-h-0 w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md px-4 py-3 font-mono text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:border-[#7B7FBF] resize-none"
          />
        ) : (
          <div
            className="flex-1 min-h-0 overflow-y-auto prose prose-stone dark:prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: renderedBody }}
          />
        )}
      </div>
    </div>
  );
}
