'use client';

import type { JsonObject } from '@sticky-notes/contracts';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { forwardRef, useEffect, useImperativeHandle } from 'react';

export interface RichTextEditorHandle {
  selectedText: () => string;
  replaceSelection: (text: string) => void;
  appendText: (text: string) => void;
}

interface RichTextEditorProps {
  content: JsonObject;
  onChange: (content: JsonObject) => void;
  disabled?: boolean;
}

function textNodes(text: string) {
  return text.split(/\n+/).filter(Boolean).map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] }));
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  { content, onChange, disabled = false },
  ref,
) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ allowBase64: false, inline: false }),
      Placeholder.configure({ placeholder: '从一个想法开始…' }),
    ],
    content,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'tiptap-editor', 'aria-label': '便签正文' },
    },
    onUpdate: ({ editor: activeEditor }) => onChange(activeEditor.getJSON() as JsonObject),
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  useImperativeHandle(ref, () => ({
    selectedText: () => {
      if (!editor) return '';
      const { from, to } = editor.state.selection;
      return editor.state.doc.textBetween(from, to, '\n').trim();
    },
    replaceSelection: (text) => {
      if (!editor) return;
      editor.chain().focus().insertContent(textNodes(text)).run();
    },
    appendText: (text) => {
      if (!editor) return;
      editor.chain().focus('end').insertContent(textNodes(text)).run();
    },
  }), [editor]);

  if (!editor) return <div className="editor-loading">正在准备编辑器…</div>;

  const addImage = () => {
    const source = window.prompt('输入图片的 HTTPS 地址');
    if (!source) return;
    try {
      const url = new URL(source);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      editor.chain().focus().setImage({ src: url.toString() }).run();
    } catch {
      window.alert('请输入有效的 HTTP 或 HTTPS 图片地址');
    }
  };

  const preserveSelection = (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault();

  return (
    <div className="rich-editor">
      <div className="editor-toolbar" aria-label="富文本工具栏">
        <button type="button" className={editor.isActive('bold') ? 'active' : ''} onMouseDown={preserveSelection} onClick={() => editor.chain().focus().toggleBold().run()}>粗体</button>
        <button type="button" className={editor.isActive('italic') ? 'active' : ''} onMouseDown={preserveSelection} onClick={() => editor.chain().focus().toggleItalic().run()}>斜体</button>
        <button type="button" className={editor.isActive('bulletList') ? 'active' : ''} onMouseDown={preserveSelection} onClick={() => editor.chain().focus().toggleBulletList().run()}>项目</button>
        <button type="button" className={editor.isActive('orderedList') ? 'active' : ''} onMouseDown={preserveSelection} onClick={() => editor.chain().focus().toggleOrderedList().run()}>编号</button>
        <button type="button" className={editor.isActive('taskList') ? 'active' : ''} onMouseDown={preserveSelection} onClick={() => editor.chain().focus().toggleTaskList().run()}>待办</button>
        <button type="button" className={editor.isActive('blockquote') ? 'active' : ''} onMouseDown={preserveSelection} onClick={() => editor.chain().focus().toggleBlockquote().run()}>引用</button>
        <button type="button" onMouseDown={preserveSelection} onClick={addImage}>图片</button>
        <span className="toolbar-spacer" />
        <button type="button" onMouseDown={preserveSelection} onClick={() => editor.chain().focus().undo().run()}>撤销</button>
        <button type="button" onMouseDown={preserveSelection} onClick={() => editor.chain().focus().redo().run()}>重做</button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
});
