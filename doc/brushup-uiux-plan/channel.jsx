/* eslint-disable */
/* Channel view — message stream + composer + optional context rail */

const Stream = () => (
  <div className="stream">
    <div className="daysep">今日 · 11月3日 月曜</div>

    <div className="msg start">
      <div className="gutter">
        <Avatar kind="av-2" initials="MS" size={36} square/>
      </div>
      <div className="body">
        <div className="who">
          <span className="name">松田 さくら</span>
          <span className="role-tag">PM</span>
          <span className="time">10:42</span>
        </div>
        <div className="text">
          <p>新しい受信箱の方向性、いったんラフを共有しました。<a style={{ color: "var(--accent)" }}>#design-review</a> の議論を踏まえて、メンション・リマインダー・スレッドを一画面で捌けるようにしています。</p>
        </div>
        <div className="reactions">
          <span className="reaction me">👍 4</span>
          <span className="reaction">🎉 2</span>
          <span className="reaction">👀 1</span>
          <span className="reaction-add"><Icon name="smile" size={11}/></span>
        </div>
      </div>
      <div className="actions">
        <button><Icon name="smile" size={14}/></button>
        <button><Icon name="reply" size={14}/></button>
        <button><Icon name="thread" size={14}/></button>
        <button><Icon name="bookmark" size={14}/></button>
        <button><Icon name="moreV" size={14}/></button>
      </div>
    </div>

    <div className="msg start">
      <div className="gutter"><Avatar kind="av-3" initials="HK" size={36} square/></div>
      <div className="body">
        <div className="who">
          <span className="name">橋本 健太</span>
          <span className="time">10:48</span>
        </div>
        <div className="text">
          <p>サイドバーの2層化、想定よりだいぶスッキリしますね。検索の保存ビューがホーム側に移ったのも良いと思います。</p>
        </div>
        <div className="threadlink">
          <div className="stack">
            <Avatar kind="av-2" initials="M" size={18}/>
            <Avatar kind="av-1" initials="N" size={18}/>
            <Avatar kind="av-5" initials="T" size={18}/>
          </div>
          <span>5件の返信</span>
          <span className="last">最終: 11:12</span>
        </div>
      </div>
    </div>

    <div className="msg continued">
      <div className="gutter">10:49</div>
      <div className="body">
        <div className="text">
          <p>ひとつだけ、Context rail のデフォルト幅は320pxで良さそう？モバイルではどう畳む想定ですか。</p>
        </div>
      </div>
    </div>

    <div className="msg start">
      <div className="gutter"><Avatar kind="av-1" initials="NK" size={36} square/></div>
      <div className="body">
        <div className="who">
          <span className="name">中村</span>
          <span className="role-tag">Design</span>
          <span className="time">11:05</span>
        </div>
        <div className="quoted">
          <div className="qwho">橋本 健太</div>
          Context rail のデフォルト幅は320pxで良さそう？
        </div>
        <div className="text">
          <p>320px+折り畳み、モバイルではボトムシートに切り替える想定です。配色トークンは <code>oklch(0.55 0.15 250)</code> をベースに 1色のみ。</p>
        </div>
        <div className="codeblock">
          <div><span className="com">/* tokens */</span></div>
          <div><span className="kw">--accent</span>: <span className="str">oklch(0.55 0.15 250)</span>;</div>
          <div><span className="kw">--bg</span>:     <span className="str">oklch(0.985 0.004 240)</span>;</div>
          <div><span className="kw">--surface</span>:<span className="str">oklch(1 0 0)</span>;</div>
          <div><span className="kw">--radius-md</span>: <span className="num">8px</span>;</div>
        </div>
        <div className="reactions">
          <span className="reaction me">✅ 3</span>
          <span className="reaction">🔵 2</span>
        </div>
      </div>
    </div>

    <div className="msg start">
      <div className="gutter"><Avatar kind="av-4" initials="OY" size={36} square/></div>
      <div className="body">
        <div className="who">
          <span className="name">大野 結衣</span>
          <span className="time">11:18</span>
        </div>
        <div className="text">
          <p>添付の構成案、確認しました 👀</p>
        </div>
        <div className="attachment">
          <div className="thumb img-placeholder">image.png · 1440×900</div>
          <div className="meta">
            <div className="fname">sidebar-redesign-v3.png</div>
            <div className="fsize">PNG · 284 KB · 中村が添付</div>
          </div>
        </div>
      </div>
    </div>

    <div className="msg start">
      <div className="gutter"><Avatar kind="av-5" initials="TK" size={36} square/></div>
      <div className="body">
        <div className="who">
          <span className="name">田中 健司</span>
          <span className="time">11:24</span>
        </div>
        <div className="text">
          <p>合わせて<code>/event</code> の入口がメッセージ内導線として薄くなる気がしました。Context rail の「予定」タブから素直に開けると嬉しい。</p>
        </div>
        <div className="threadlink">
          <div className="stack">
            <Avatar kind="av-1" initials="N" size={18}/>
            <Avatar kind="av-3" initials="H" size={18}/>
          </div>
          <span>2件の返信</span>
          <span className="last">最終: 11:31</span>
        </div>
      </div>
    </div>
  </div>
);

const Composer = () => (
  <div className="composer">
    <div className="composer-toolbar">
      <button className="icon-btn"><Icon name="bold" size={14}/></button>
      <button className="icon-btn"><Icon name="italic" size={14}/></button>
      <span className="sep"/>
      <button className="icon-btn"><Icon name="link" size={14}/></button>
      <button className="icon-btn"><Icon name="list" size={14}/></button>
      <button className="icon-btn"><Icon name="code" size={14}/></button>
      <button className="icon-btn"><Icon name="quote" size={14}/></button>
      <span className="sep-spacer"/>
      <button className="icon-btn" title="テンプレート"><Icon name="template" size={14}/></button>
      <button className="icon-btn" title="予約送信"><Icon name="clock" size={14}/></button>
    </div>
    <div className="composer-input placeholder">#design-review にメッセージを送る…</div>
    <div className="composer-foot">
      <div className="hints">
        <kbd>@</kbd> メンション ・ <kbd>/</kbd> コマンド ・ <kbd>⇧⏎</kbd> 改行
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button className="icon-btn"><Icon name="paperclip" size={15}/></button>
        <button className="icon-btn"><Icon name="emoji" size={15}/></button>
        <button className="icon-btn"><Icon name="at" size={15}/></button>
        <button className="send-btn"><Icon name="send" size={13}/>送信</button>
      </div>
    </div>
  </div>
);

const ChannelTopbar = ({ onContext, contextOn }) => (
  <header className="topbar">
    <div className="crumb">
      <span style={{ color: "var(--text-faint)" }}>#</span>
      design-review
    </div>
    <span className="topic">プロダクトデザインのレビュー・素材共有 · 編集中の案件は #specs-q2 へ</span>
    <div className="topbar-spacer"/>
    <div className="members">
      <Avatar kind="av-1" initials="N" size={24}/>
      <Avatar kind="av-2" initials="M" size={24}/>
      <Avatar kind="av-3" initials="H" size={24}/>
      <Avatar kind="av-4" initials="O" size={24}/>
      <div className="avatar more" style={{ width: 24, height: 24, borderRadius: "50%" }}>+4</div>
    </div>
    <button className="icon-btn"><Icon name="bell" size={16}/></button>
    <button className="icon-btn"><Icon name="search" size={16}/></button>
    <button className="icon-btn" aria-current={contextOn} onClick={onContext}><Icon name="panelR" size={16}/></button>
  </header>
);

const ContextRail = () => (
  <aside className="context">
    <div className="context-head">
      <div className="title">#design-review</div>
      <button className="icon-btn"><Icon name="x" size={14}/></button>
    </div>
    <div className="context-tabs">
      <button className="context-tab" aria-current="true">概要</button>
      <button className="context-tab">ピン留め <span style={{ color: "var(--text-faint)" }}>4</span></button>
      <button className="context-tab">ファイル</button>
      <button className="context-tab">予定</button>
    </div>
    <div className="context-body">
      <div className="context-section-head">トピック</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, padding: "0 4px" }}>
        プロダクトデザインのレビュー・素材共有。編集中の案件は #specs-q2、最終決定は #launch-private へ。
      </div>

      <div className="context-section-head">ピン留め</div>
      <div className="context-card">
        <div className="who"><Avatar kind="av-2" initials="MS" size={16} square/>松田 さくら · 10/28</div>
        <div className="text">Q4のデザインレビュー運用ルール。レビュー依頼は火・木の朝、PRリンクとセットで投稿。</div>
        <div className="meta"><Icon name="message" size={11}/>12 · <Icon name="bookmark" size={11}/>5</div>
      </div>
      <div className="context-card">
        <div className="who"><Avatar kind="av-1" initials="NK" size={16} square/>中村 · 10/30</div>
        <div className="text">配色・タイポトークン v3.1。oklchに移行済み。Tweaksでライト/ダーク切替可能。</div>
        <div className="meta"><Icon name="message" size={11}/>3</div>
      </div>

      <div className="context-section-head">メンバー · 8</div>
      <div className="context-member">
        <Avatar kind="av-2" initials="MS" size={22} presence="online"/>
        <span>松田 さくら</span>
        <span className="role">PM</span>
      </div>
      <div className="context-member">
        <Avatar kind="av-1" initials="NK" size={22} presence="online"/>
        <span>中村</span>
        <span className="role">Design</span>
      </div>
      <div className="context-member">
        <Avatar kind="av-3" initials="HK" size={22} presence="away"/>
        <span>橋本 健太</span>
        <span className="role">Eng</span>
      </div>
      <div className="context-member">
        <Avatar kind="av-4" initials="OY" size={22} presence="dnd"/>
        <span>大野 結衣</span>
        <span className="role">Eng</span>
      </div>
      <div className="context-member">
        <Avatar kind="av-5" initials="TK" size={22} presence="offline"/>
        <span>田中 健司</span>
        <span className="role">Data</span>
      </div>

      <div className="context-section-head">最近のファイル</div>
      <div className="context-file">
        <div className="ico"><Icon name="files" size={14}/></div>
        <div className="info">
          <div className="n">sidebar-redesign-v3.png</div>
          <div className="d">中村 · 11月3日</div>
        </div>
      </div>
      <div className="context-file">
        <div className="ico"><Icon name="files" size={14}/></div>
        <div className="info">
          <div className="n">tokens-v3.1.css</div>
          <div className="d">中村 · 10月30日</div>
        </div>
      </div>
    </div>
  </aside>
);

window.Stream = Stream;
window.Composer = Composer;
window.ChannelTopbar = ChannelTopbar;
window.ContextRail = ContextRail;
