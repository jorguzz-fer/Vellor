import { useEffect } from 'react';

const SUFFIX = ' | Vellor';

/** Define título e descrição da página (SEO básico para SPA). */
export function usePageMeta(title: string | undefined, description?: string): void {
  useEffect(() => {
    if (title) document.title = title.endsWith('Vellor') ? title : `${title}${SUFFIX}`;
    if (description) {
      let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!tag) {
        tag = document.createElement('meta');
        tag.name = 'description';
        document.head.appendChild(tag);
      }
      tag.content = description;
    }
  }, [title, description]);
}
