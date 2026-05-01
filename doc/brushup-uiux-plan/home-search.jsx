/* eslint-disable */
/* Home (Focus inbox), Search view, and Mobile screens */

const Home = () => {
  const [tab, setTab] = React.useState("mentions");
  return (
    <div className="home">
      <div className="home-hero">
        <h1>おはようございます、中村さん</h1>
        <div className="sub">未対応のメンションが <strong style={{ color: "var(--text)" }}>4件</strong>、リマインダーが <strong style={{ color: "var(--text)" }}>2件</strong>。今日は午後2時に design-review。</div>
      </div>
      <div className="home-tabs">
        <button className="home-tab" aria-current={tab === "mentions"} onClick={() => setTab("mentions")}>
          メンション<span className="count">4</span>
        </button>
        <button className="home-tab" aria-current={tab === "threads"} onClick={() => setTab("threads")}>
          スレッド<span className="count">7</span>
        </button>
        <button className="home-tab" aria-current={tab === "reminders"}>
          リマインダー<span className="count">2</span>
        </button>
        <button className="home-tab" aria-current={tab === "drafts"}>
          下書き<span className="count">3</span>
        </button>
        <button className="home-tab" aria-current={tab === "all"}>
          すべて
        </button>
      </div>
      <div className="home-body">
        <div className="summary-grid">
          <div className="summary-card">
            <div className="label">未読</div>
            <div className="value">37</div>
            <div className="delta">5チャンネル · <span className="dn">+12</span> 昨日比</div>
          </div>
          <div className="summary-card">
            <div className="label">予定</div>
            <div className="value">3</div>
            <div className="delta">14:00 design-review · 16:30 1on1</div>
          </div>
          <div className="summary-card">
            <div className="label">タスク</div>
            <div className="value">8</div>
            <div className="delta"><span className="up">2件完了</span> · 今週中の期限 3件</div>
          </div>
        </div>

        <div className="section-header">
          <h2>あなたへのメンション</h2>
          <div className="ln"/>
          <span className="count">4件</span>
        </div>

        <div className="inbox-card">
          <Avatar kind="av-2" initials="MS" size={36} square/>
          <div className="body">
            <div className="source">
              <span className="pill"><Icon name="at" size={10}/>メンション</span>
              <span>#design-review · 今</span>
            </div>
            <div className="who">松田 さくら</div>
            <div className="text"><strong style={{ color: "var(--accent)" }}>@中村</strong> 受信箱の方向性、いったんラフを共有しました。design-review の議論を踏まえて、メンション・リマインダー・スレッドを一画面で捌けるようにしています。</div>
          </div>
          <div className="meta">
            <span>11:42</span>
            <div className="quick">
              <button className="icon-btn"><Icon name="reply" size={13}/></button>
              <button className="icon-btn"><Icon name="check" size={13}/></button>
            </div>
          </div>
        </div>

        <div className="inbox-card">
          <Avatar kind="av-3" initials="HK" size={36} square/>
          <div className="body">
            <div className="source">
              <span className="pill"><Icon name="thread" size={10}/>スレッド返信</span>
              <span>#specs-q2 · 25分前</span>
            </div>
            <div className="who">橋本 健太</div>
            <div className="text">仕様の最終確認お願いします。Context rail の挙動は仮で組んでいるので、明日午前にレビューさせてください。</div>
          </div>
          <div className="meta">
            <span>11:17</span>
            <div className="quick">
              <button className="icon-btn"><Icon name="reply" size={13}/></button>
              <button className="icon-btn"><Icon name="check" size={13}/></button>
            </div>
          </div>
        </div>

        <div className="inbox-card">
          <Avatar kind="av-4" initials="OY" size={36} square/>
          <div className="body">
            <div className="source">
              <span className="pill"><Icon name="at" size={10}/>メンション</span>
              <span>DM · 1時間前</span>
            </div>
            <div className="who">大野 結衣</div>
            <div className="text">トークン v3.1 のダークモードの状態色、テストしてレポート上げました。コントラスト比は WCAG AA 全部クリアです。</div>
          </div>
          <div className="meta">
            <span>10:38</span>
            <div className="quick">
              <button className="icon-btn"><Icon name="reply" size={13}/></button>
              <button className="icon-btn"><Icon name="check" size={13}/></button>
            </div>
          </div>
        </div>

        <div className="section-header">
          <h2>リマインダー</h2>
          <div className="ln"/>
          <span className="count">2件</span>
        </div>

        <div className="inbox-card">
          <div className="avatar av-6" style={{ width: 36, height: 36, borderRadius: 9 }}>
            <Icon name="clock" size={16}/>
          </div>
          <div className="body">
            <div className="source">
              <span className="pill" style={{ background: "oklch(0.78 0.15 75 / 0.18)", color: "oklch(0.55 0.16 75)" }}>
                <Icon name="clock" size={10}/>14:00に通知
              </span>
              <span>#launch-private · 田中 健司</span>
            </div>
            <div className="who">「リリース判定の最終チェックは午後イチで」</div>
            <div className="text" style={{ color: "var(--text-muted)" }}>3時間後にリマインドします</div>
          </div>
          <div className="meta">
            <span>あと 3時間</span>
            <div className="quick">
              <button className="icon-btn"><Icon name="check" size={13}/></button>
            </div>
          </div>
        </div>

        <div className="inbox-card">
          <div className="avatar av-6" style={{ width: 36, height: 36, borderRadius: 9 }}>
            <Icon name="clock" size={16}/>
          </div>
          <div className="body">
            <div className="source">
              <span className="pill" style={{ background: "oklch(0.78 0.15 75 / 0.18)", color: "oklch(0.55 0.16 75)" }}>
                <Icon name="clock" size={10}/>明日 09:00
              </span>
              <span>自分用</span>
            </div>
            <div className="who">「Tweaks の幅3段階の比較スクショを作る」</div>
          </div>
          <div className="meta">
            <span>明日</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const SearchView = () => (
  <div className="home">
    <div className="search-head">
      <div className="search-input-row">
        <Icon name="search" size={18}/>
        <span className="chip">from:松田<span className="x"><Icon name="x" size={10}/></span></span>
        <span className="chip">in:#design-review<span className="x"><Icon name="x" size={10}/></span></span>
        <span className="chip">has:📎<span className="x"><Icon name="x" size={10}/></span></span>
        <input defaultValue="トークン" />
        <kbd style={{
          padding: "2px 6px", borderRadius: 4,
          background: "var(--surface)", border: "1px solid var(--border)",
          fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)"
        }}>Esc</kbd>
      </div>
      <div className="search-filters">
        <span className="chip-add"><Icon name="plus" size={11}/>日付</span>
        <span className="chip-add"><Icon name="plus" size={11}/>チャンネル</span>
        <span className="chip-add"><Icon name="plus" size={11}/>添付タイプ</span>
        <span className="chip-add"><Icon name="plus" size={11}/>タグ</span>
      </div>
      <div className="search-savedviews">
        <span>保存ビュー</span>
        <span className="pill active">⭐ 自分宛・未対応</span>
        <span className="pill">レビュー待ち</span>
        <span className="pill">添付ありの最新</span>
        <span className="pill">+ 現在の条件を保存</span>
      </div>
    </div>
    <div className="home-body" style={{ padding: 0 }}>
      <div className="result-row">
        <div className="crumb"><Icon name="hash" size={11}/>design-review · 11月3日 11:05</div>
        <div className="who">
          <span className="name">中村</span>
          <span className="time">あなたが投稿</span>
        </div>
        <div className="snippet">
          配色<mark>トークン</mark>は <code style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, padding: "1px 5px", background: "var(--surface-2)", borderRadius: 4 }}>oklch(0.55 0.15 250)</code> をベースに 1色のみ。ライト/ダーク両対応で <mark>トークン</mark> v3.1 として整理済み。
        </div>
      </div>
      <div className="result-row">
        <div className="crumb"><Icon name="hash" size={11}/>specs-q2 · 10月30日 16:21</div>
        <div className="who">
          <span className="name">松田 さくら</span>
          <span className="time">3件のリアクション</span>
        </div>
        <div className="snippet">
          v3.1の<mark>トークン</mark>を共有。新ブランド色に合わせてアクセント・ステータス色を調整しています。レビューお願いします @中村 @橋本
        </div>
      </div>
      <div className="result-row">
        <div className="crumb"><Icon name="hash" size={11}/>design-review · 10月28日 14:02</div>
        <div className="who">
          <span className="name">大野 結衣</span>
          <span className="time">📎 tokens-v3.1.css</span>
        </div>
        <div className="snippet">
          <mark>トークン</mark>のコントラスト検証結果。AA/AAA をすべて満たしています。ダークの surface-2 のみ要再検討。
        </div>
      </div>
      <div className="result-row">
        <div className="crumb"><Icon name="message" size={11}/>松田 さくらとのDM · 10月25日</div>
        <div className="who">
          <span className="name">松田 さくら</span>
        </div>
        <div className="snippet">
          配色<mark>トークン</mark>のリストアップ、ありがとうございます。次の定例でレビューしましょう。
        </div>
      </div>
    </div>
  </div>
);

window.Home = Home;
window.SearchView = SearchView;
