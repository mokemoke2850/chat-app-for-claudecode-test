/* eslint-disable */
/* ============================================================
   Desktop chat shell — used inside an artboard
   ============================================================ */

const Avatar = ({ kind = "av-1", initials, size, presence, square }) => (
  <div className={`avatar ${kind}`} style={{
    width: size, height: size,
    borderRadius: square ? Math.round(size * 0.25) : "50%",
  }}>
    {initials}
    {presence && <span className={`presence presence-${presence}`}/>}
  </div>
);

const Rail = ({ active = "channels", inboxCount = 4 }) => (
  <aside className="rail">
    <div className="rail-logo">N</div>
    <button className="rail-btn" aria-current={active === "home"} title="ホーム">
      <Icon name="inbox" size={18}/>
      {inboxCount > 0 && <span className="badge">{inboxCount}</span>}
    </button>
    <button className="rail-btn" aria-current={active === "channels"} title="チャット">
      <Icon name="message" size={18}/>
    </button>
    <button className="rail-btn" title="DM">
      <Icon name="users" size={18}/>
      <span className="badge">2</span>
    </button>
    <button className="rail-btn" aria-current={active === "search"} title="検索">
      <Icon name="search" size={18}/>
    </button>
    <div className="rail-divider"/>
    <button className="rail-btn" title="カレンダー">
      <Icon name="calendar" size={18}/>
    </button>
    <button className="rail-btn" title="タスク">
      <Icon name="task" size={18}/>
    </button>
    <button className="rail-btn" title="ファイル">
      <Icon name="files" size={18}/>
    </button>
    <button className="rail-btn" title="ブックマーク">
      <Icon name="bookmark" size={18}/>
    </button>
    <div className="rail-spacer"/>
    <button className="rail-btn" title="テンプレート">
      <Icon name="template" size={18}/>
    </button>
    <button className="rail-btn" title="管理">
      <Icon name="shield" size={18}/>
    </button>
  </aside>
);

const ListColumn = ({ activeId = "design-review" }) => (
  <aside className="list">
    <div className="list-header">
      <div className="list-title">Nimbus<span style={{ color: "var(--text-faint)", fontWeight: 400, marginLeft: 6, fontSize: 12 }}>workspace</span></div>
      <button className="icon-btn" title="メニュー"><Icon name="caret" size={14}/></button>
    </div>
    <div className="list-search">
      <Icon name="command" size={13}/>
      <input placeholder="ジャンプ… ⌘K" />
    </div>
    <div className="list-body">
      {/* Pinned */}
      <div className="list-section">
        <div className="list-section-head">
          <span>ピン留め</span>
        </div>
        <div className="list-row">
          <span className="row-prefix"><Icon name="pin" size={12}/></span>
          <span className="row-label">general</span>
        </div>
        <div className="list-row unread">
          <span className="row-prefix">#</span>
          <span className="row-label">design-review</span>
          <span className="row-badge">3</span>
        </div>
      </div>

      {/* Product section */}
      <div className="list-section">
        <div className="list-section-head">
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Icon name="caret" size={10}/>Product
          </span>
          <button className="add-btn"><Icon name="plus" size={11}/></button>
        </div>
        <div className="list-row" aria-current={activeId === "design-review"}>
          <span className="row-prefix">#</span>
          <span className="row-label">design-review</span>
        </div>
        <div className="list-row unread">
          <span className="row-prefix">#</span>
          <span className="row-label">specs-q2</span>
          <span className="row-badge">12</span>
        </div>
        <div className="list-row">
          <span className="row-prefix">#</span>
          <span className="row-label">growth</span>
        </div>
        <div className="list-row">
          <span className="row-prefix"><Icon name="lock" size={11}/></span>
          <span className="row-label">launch-private</span>
        </div>
      </div>

      {/* Engineering */}
      <div className="list-section">
        <div className="list-section-head">
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Icon name="caret" size={10}/>Engineering
          </span>
          <button className="add-btn"><Icon name="plus" size={11}/></button>
        </div>
        <div className="list-row">
          <span className="row-prefix">#</span>
          <span className="row-label">eng-frontend</span>
        </div>
        <div className="list-row unread">
          <span className="row-prefix">#</span>
          <span className="row-label">eng-backend</span>
          <span className="row-badge muted">+24</span>
        </div>
        <div className="list-row">
          <span className="row-prefix">#</span>
          <span className="row-label">incidents</span>
        </div>
      </div>

      {/* DM section */}
      <div className="list-section">
        <div className="list-section-head">
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Icon name="caret" size={10}/>ダイレクトメッセージ
          </span>
          <button className="add-btn"><Icon name="plus" size={11}/></button>
        </div>
        <div className="dm-row unread">
          <Avatar kind="av-2" initials="MS" size={26} presence="online"/>
          <span style={{ flex: 1 }}>松田 さくら</span>
          <span className="row-badge">2</span>
        </div>
        <div className="dm-row">
          <Avatar kind="av-3" initials="HK" size={26} presence="away"/>
          <span style={{ flex: 1 }}>橋本 健太</span>
        </div>
        <div className="dm-row">
          <Avatar kind="av-4" initials="OY" size={26} presence="dnd"/>
          <span style={{ flex: 1 }}>大野 結衣</span>
        </div>
        <div className="dm-row">
          <Avatar kind="av-5" initials="TK" size={26} presence="offline"/>
          <span style={{ flex: 1, color: "var(--text-faint)" }}>田中 健司</span>
        </div>
        <div className="dm-row">
          <div style={{
            width: 26, height: 26, borderRadius: "50%",
            background: "var(--surface-2)",
            display: "grid", placeItems: "center",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
            position: "relative",
          }}>
            <Icon name="users" size={13}/>
          </div>
          <span style={{ flex: 1 }}>製品企画 + 3人</span>
        </div>
      </div>
    </div>
    <div className="list-footer">
      <Avatar initials="NK" size={32} presence="online"/>
      <div className="who">
        <div className="name">中村</div>
        <div className="status"><span style={{
          width: 6, height: 6, borderRadius: "50%", background: "var(--status-online)" }}/>会議中まで30分</div>
      </div>
      <button className="icon-btn"><Icon name="sliders" size={15}/></button>
    </div>
  </aside>
);

window.Avatar = Avatar;
window.Rail = Rail;
window.ListColumn = ListColumn;
