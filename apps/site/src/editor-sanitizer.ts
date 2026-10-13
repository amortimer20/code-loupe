// Monaco 0.52 embeds an old DOMPurify copy. Use the maintained package instead.
import DOMPurify from 'dompurify';
export const { sanitize, addHook, removeHook } = DOMPurify;
