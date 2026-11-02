import { Link } from 'react-router-dom';

export function PageHeader({ title, draftTitle, draftId, editing = false, list = false }: {
  title: string; draftTitle?: string; draftId?: string; editing?: boolean; list?: boolean;
}) {
  return <header className="task-heading">
    <nav aria-label="Breadcrumb"><ol>
      <li>{list ? <span aria-current="page">My Drafts</span> : <Link to="/contributor">My Drafts</Link>}</li>
      {!list && draftId && <li className="draft-title-crumb">{editing ? <Link to={`/contributor/drafts/${encodeURIComponent(draftId)}`} title={draftTitle ?? 'Draft details'}>{draftTitle ?? 'Draft details'}</Link> : <span aria-current="page" title={draftTitle ?? 'Draft details'}>{draftTitle ?? 'Draft details'}</span>}</li>}
      {!list && (!draftId || editing) && <li><span aria-current="page">{editing ? 'Edit' : 'Create Draft'}</span></li>}
    </ol></nav>
    <h1>{title}</h1>
  </header>;
}
