(function () {
  const { db, esc, badge, date, num, opt, icon } = HH;
  const view = HH.shell({ title: 'Content & SEO', subtitle: 'Website pages, blog posts and search snippets', actions: `<button class="btn btn-primary" id="newPost">${icon('plus')}New blog post</button>` });
  function render() {
    view.innerHTML = `<section class="card"><div class="card-head"><h2>Website pages</h2><span class="muted small">homehancer.co.in</span></div><div class="table-wrap"><table><thead><tr><th>Page</th><th>URL</th><th>Meta description</th><th>Updated</th><th></th></tr></thead><tbody>
        ${db.pages.map(p => `<tr><td class="cell-main">${esc(p.title)}</td><td class="mono">/${esc(p.slug)}</td><td>${p.metaDesc ? `<span class="small">${esc(p.metaDesc.slice(0, 60))}${p.metaDesc.length > 60 ? '…' : ''}</span>` : '<span class="badge b-warn">Missing</span>'}</td><td class="cell-sub">${date(p.updated)}</td><td class="right"><button class="btn btn-sm" data-page="${p.id}">${icon('edit')}Edit</button></td></tr>`).join('')}
      </tbody></table></div></section><section class="card" id="blogTbl"></section>`;
    view.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => editor(HH.by(db.pages, b.dataset.page), 'page')));
    HH.table(document.getElementById('blogTbl'), {
      rows: () => db.blogs,
      tabs: { items: [['all', 'All posts'], ['published', 'Published'], ['draft', 'Drafts'], ['scheduled', 'Scheduled']], match: (b, k) => k === 'all' || b.status === k },
      search: { placeholder: 'Title', fields: b => [b.title, b.slug] },
      columns: [
        { key: 't', label: 'Post', sort: b => b.title, render: b => `<div class="cell-main">${esc(b.title)}</div><div class="cell-sub mono">/ourBlogs/${esc(b.slug)}</div>` },
        { key: 'a', label: 'Author', render: b => esc(b.author) },
        { key: 'v', label: 'Views', align: 'right', sort: b => b.views, render: b => `<span class="num">${num(b.views)}</span>` },
        { key: 'd', label: 'Date', sort: b => b.at, render: b => `<span class="cell-sub">${date(b.at)}</span>` },
        { key: 's', label: 'Status', render: b => badge('generic', b.status) }
      ],
      onRow: b => editor(b, 'blog')
    });
  }
  function editor(item, kind) {
    const isNew = !item;
    item = item || { id: 'B' + Date.now(), title: '', slug: '', status: 'draft', author: HH.session.name, at: new Date().toISOString(), metaTitle: '', metaDesc: '', body: '', views: 0 };
    const m = HH.modal({
      title: isNew ? 'New blog post' : 'Edit ' + esc(item.title), wide: true,
      body: `<form class="stack" id="ef">
        <div class="form-grid"><div class="field"><label for="e-title">Title</label><input id="e-title" name="title" value="${esc(item.title)}"></div><div class="field"><label for="e-slug">URL slug</label><input id="e-slug" name="slug" value="${esc(item.slug)}" class="mono"></div>
        ${kind === 'blog' ? `<div class="field"><label for="e-status">Status</label><select id="e-status" name="status">${opt([['draft', 'Draft'], ['published', 'Published'], ['scheduled', 'Scheduled']], item.status)}</select></div><div class="field"><label for="e-cover">Cover image</label><input id="e-cover" type="file" accept="image/*" style="padding-top:6px"></div>` : ''}</div>
        <div class="field"><label for="e-body">Content</label><textarea id="e-body" name="body" rows="9">${esc(item.body)}</textarea><span class="hint">Markdown supported: ## heading, **bold**, - list</span></div>
        <div class="section-title">Search engine snippet</div>
        <div class="form-grid"><div class="field full"><label for="e-mt">Meta title <span class="muted" id="mtc"></span></label><input id="e-mt" name="metaTitle" value="${esc(item.metaTitle)}"></div><div class="field full"><label for="e-md">Meta description <span class="muted" id="mdc"></span></label><textarea id="e-md" name="metaDesc" rows="2">${esc(item.metaDesc)}</textarea></div></div>
        <div class="card card-body" style="background:var(--surface-2)"><div class="small muted">Google preview</div><div id="gp"></div></div>
      </form>`,
      foot: `${!isNew && kind === 'blog' ? '<button class="btn btn-danger" id="e-del">Delete</button><span class="spacer"></span>' : ''}<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="e-ok">Save</button>`
    });
    const preview = () => {
      const f = HH.formData(m.$('#ef')), mt = f.metaTitle || f.title, md = f.metaDesc;
      m.$('#mtc').textContent = `${mt.length}/60`; m.$('#mdc').textContent = `${md.length}/160`;
      m.$('#mtc').style.color = mt.length > 60 ? 'var(--bad)' : ''; m.$('#mdc').style.color = md.length > 160 || !md ? 'var(--bad)' : '';
      m.$('#gp').innerHTML = `<div class="small" style="color:var(--good)">homehancer.co.in › ${kind === 'blog' ? 'ourBlogs › ' : ''}${esc(f.slug)}</div><div style="color:var(--accent);font-size:18px">${esc(mt.slice(0, 60)) || 'Page title'}</div><div class="small">${esc(md.slice(0, 160)) || '<span class="muted">Add a meta description so Google shows your text instead of guessing.</span>'}</div>`;
    };
    m.$('#e-title').addEventListener('input', () => { if (isNew) m.$('#e-slug').value = m.$('#e-title').value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); });
    m.el.addEventListener('input', preview); preview();
    m.$('#e-ok').addEventListener('click', () => {
      const f = HH.formData(m.$('#ef'));
      if (!f.title.trim() || !/^[A-Za-z0-9-]+$/.test(f.slug)) return HH.toast('Add a title and a slug using letters, digits and hyphens.', 'bad');
      Object.assign(item, f, kind === 'page' ? { updated: new Date().toISOString() } : {});
      if (isNew) db.blogs.unshift(item);
      HH.audit(`Saved ${kind} “${item.title}”`); HH.save(); m.close(); render(); HH.toast('Saved.', 'good');
    });
    m.$('#e-del')?.addEventListener('click', async () => { if (await HH.confirmDialog({ title: 'Delete this post?', text: item.title, ok: 'Delete', danger: true })) { db.blogs.splice(db.blogs.indexOf(item), 1); HH.save(); m.close(); render(); } });
  }
  document.getElementById('newPost').addEventListener('click', () => editor(null, 'blog'));
  render();
})();
