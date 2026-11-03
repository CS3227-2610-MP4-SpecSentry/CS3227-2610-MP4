import { Link } from 'react-router-dom';

export function PageHeader({ title, draftTitle, draftId, editing = false, list = false }: {
  title: string; draftTitle?: string; draftId?: string; editing?: boolean; list?: boolean;
}) {
  return <header className="task-heading">
    <nav aria-label="Breadcrumb"><ol>
      <li><Link to="/contributor" aria-label="Contributor workspace breadcrumb">Workspace</Link></li>
      <li>{list ? <span aria-current="page">Drafts</span> : <Link to="/contributor">Drafts</Link>}</li>
      {!list && draftId && <li className="draft-title-crumb">{editing ? <Link to={`/contributor/drafts/${encodeURIComponent(draftId)}`} title={draftTitle ?? 'Draft details'}>{draftTitle ?? 'Draft details'}</Link> : <span aria-current="page" title={draftTitle ?? 'Draft details'}>{draftTitle ?? 'Draft details'}</span>}</li>}
      {!list && (!draftId || editing) && <li><span aria-current="page">{editing ? 'Edit' : 'Create draft'}</span></li>}
    </ol></nav>
    <h1>{title}</h1>
  </header>;
}
