/* eslint-disable */
/* Mobile screens — wrapped by an iPhone-ish frame inside the artboard */

const MobStatus = () => (
  <div className="mob-status">
    <span>9:41</span>
    <div className="right">
      <Icon name="signal" size={13}/>
      <Icon name="wifi" size={13}/>
      <Icon name="battery" size={15}/>
    </div>
  </div>
);

const MobHome = () => (
  <div className="mob">
    <MobStatus/>
    <div className="mob-top">
      <Avatar kind="av-1" initials="NK" size={32} presence="online"/>
      <div className="title">受信箱</div>
      <button className="icon-btn"><Icon name="search" size={18}/></button>
      <button className="icon-btn"><Icon name="edit" size={18}/></button>
    </div>
    <div className="mob-body">
      <div style={{ padding: "12px 16px 4px", display: "flex", gap: 8, overflow: "hidden" }}>
        <span className="pill" style={{
          padding: "5px 12px", borderRadius: 999,
          background: "var(--accent)", color: "var(--accent-fg)",
          fontSize: 12.5, fontWeight: 600
        }}>メンション 4</span>
        <span className="pill" style={{
          padding: "5px 12px", borderRadius: 999,
          background: "var(--surface-2)", color: "var(--text-muted)",
          fontSize: 12.5, fontWeight: 500, border: "1px solid var(--border)"
        }}>スレッド 7</span>
        <span className="pill" style={{
          padding: "5px 12px", borderRadius: 999,
          background: "var(--surface-2)", color: "var(--text-muted)",
          fontSize: 12.5, fontWeight: 500, border: "1px solid var(--border)"
        }}>リマインダー</span>
      </div>
      <div className="mob-section-h">あなたへのメンション</div>
      <div className="mob-row unread">
        <Avatar kind="av-2" initials="MS" size={40} square presence="online"/>
        <div className="body">
          <div className="top">
            <span className="n">松田 さくら</span>
            <span className="t">11:42</span>
          </div>
          <div className="preview">@中村 受信箱の方向性、ラフを共有しました…</div>
          <div style={{
            fontSize: 11, color: "var(--accent)", marginTop: 2, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 4
          }}>
            <Icon name="hash" size={10}/>design-review
          </div>
        </div>
        <div className="end">
          <span className="badge">2</span>
        </div>
      </div>
      <div className="mob-row unread">
        <Avatar kind="av-3" initials="HK" size={40} square presence="away"/>
        <div className="body">
          <div className="top">
            <span className="n">橋本 健太</span>
            <span className="t">11:17</span>
          </div>
          <div className="preview">仕様の最終確認お願いします。Context rail の…</div>
          <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            <Icon name="thread" size={10}/>specs-q2 · スレッド
          </div>
        </div>
      </div>
      <div className="mob-row unread">
        <Avatar kind="av-4" initials="OY" size={40} square presence="dnd"/>
        <div className="body">
          <div className="top">
            <span className="n">大野 結衣</span>
            <span className="t">10:38</span>
          </div>
          <div className="preview">トークン v3.1 のダークモードの状態色、テスト…</div>
          <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            <Icon name="message" size={10}/>DM
          </div>
        </div>
      </div>

      <div className="mob-section-h">今日の予定</div>
      <div className="mob-row" style={{ alignItems: "flex-start" }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: "var(--accent-soft)", color: "var(--accent)",
          display: "grid", placeItems: "center",
          flexShrink: 0,
        }}>
          <div style={{ textAlign: "center", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>11月</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>3</div>
          </div>
        </div>
        <div className="body">
          <div className="top">
            <span className="n">design-review</span>
            <span className="t">14:00</span>
          </div>
          <div className="preview">参加 5名 · #design-review に通知済み</div>
        </div>
      </div>

      <div className="mob-section-h">スレッド</div>
      <div className="mob-row">
        <Avatar kind="av-5" initials="TK" size={40} square presence="offline"/>
        <div className="body">
          <div className="top">
            <span className="n">田中 健司</span>
            <span className="t">11:31</span>
          </div>
          <div className="preview">/event の入口がメッセージ内導線として薄く…</div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>2件の返信 · #design-review</div>
        </div>
      </div>
    </div>
    <div className="mob-tabbar">
      <div className="mob-tab" aria-current="true">
        <Icon name="inbox" size={20}/><span>受信箱</span>
        <span className="badge">4</span>
      </div>
      <div className="mob-tab"><Icon name="message" size={20}/><span>チャット</span></div>
      <div className="mob-tab"><Icon name="search" size={20}/><span>検索</span></div>
      <div className="mob-tab"><Icon name="calendar" size={20}/><span>予定</span></div>
      <div className="mob-tab"><Icon name="user" size={20}/><span>自分</span></div>
    </div>
  </div>
);

const MobChannel = () => (
  <div className="mob">
    <MobStatus/>
    <div className="mob-top">
      <button className="icon-btn"><Icon name="arrowL" size={18}/></button>
      <div className="title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>#</span>design-review
      </div>
      <button className="icon-btn"><Icon name="users" size={18}/></button>
      <button className="icon-btn"><Icon name="moreV" size={18}/></button>
    </div>

    <div className="mob-body" style={{ paddingBottom: 0 }}>
      <div style={{
        margin: "10px 16px",
        padding: "8px 12px",
        background: "var(--surface-2)",
        borderRadius: 10,
        fontSize: 12, color: "var(--text-muted)",
        display: "flex", alignItems: "center", gap: 8
      }}>
        <Icon name="pin" size={13}/>4件のピン留め · タップして表示
      </div>

      <div style={{
        textAlign: "center", fontSize: 11, color: "var(--text-faint)",
        margin: "8px 0 4px", fontWeight: 600, letterSpacing: 0.5
      }}>今日 · 11月3日 月曜</div>

      <div className="mob-msg">
        <Avatar kind="av-2" initials="MS" size={32} square className="av"/>
        <div>
          <div className="who"><span className="n">松田 さくら</span><span className="t">10:42</span></div>
          <div className="text">新しい受信箱の方向性、ラフを共有しました。一画面でメンション・リマインダー・スレッドが捌ける構成です。</div>
          <div className="reactions" style={{ marginTop: 6, display: "flex", gap: 4 }}>
            <span className="reaction me" style={{ height: 22, padding: "1px 7px", borderRadius: 11 }}>👍 4</span>
            <span className="reaction" style={{ height: 22, padding: "1px 7px", borderRadius: 11 }}>🎉 2</span>
          </div>
        </div>
      </div>

      <div className="mob-msg">
        <Avatar kind="av-3" initials="HK" size={32} square className="av"/>
        <div>
          <div className="who"><span className="n">橋本 健太</span><span className="t">10:48</span></div>
          <div className="text">サイドバーの2層化、想定よりだいぶスッキリしますね。検索の保存ビューがホーム側に移ったのも良いです。</div>
          <div className="threadlink" style={{
            marginTop: 6, fontSize: 12, color: "var(--accent)",
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 8px", borderRadius: 8, background: "var(--accent-soft)"
          }}>
            <Icon name="thread" size={11}/>5件の返信
          </div>
        </div>
      </div>

      <div className="mob-msg">
        <Avatar kind="av-1" initials="NK" size={32} square className="av"/>
        <div>
          <div className="who"><span className="n">中村</span><span className="t">11:05</span></div>
          <div className="text">320px+折り畳み、モバイルではボトムシートに切り替える想定です。</div>
          <div className="codeblock" style={{
            marginTop: 6, padding: "8px 10px",
            background: "var(--surface-2)", border: "1px solid var(--border)",
            borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 11.5,
            lineHeight: 1.5,
          }}>
            <span style={{ color: "oklch(0.55 0.15 290)" }}>--accent</span>: <span style={{ color: "oklch(0.55 0.15 150)" }}>oklch(0.55 0.15 250)</span>;
          </div>
        </div>
      </div>

      <div className="mob-msg continued">
        <div className="av"/>
        <div>
          <div className="text" style={{ fontSize: 13.5 }}>あと、Context railは右からスライドで出します</div>
        </div>
      </div>
    </div>

    <div className="mob-composer">
      <button className="icon-btn"><Icon name="plus" size={20}/></button>
      <div className="field">メッセージを入力…</div>
      <div className="send"><Icon name="arrowUp" size={18}/></div>
    </div>
  </div>
);

const MobSearch = () => (
  <div className="mob">
    <MobStatus/>
    <div className="mob-top">
      <button className="icon-btn"><Icon name="arrowL" size={18}/></button>
      <div className="title">検索</div>
      <button className="icon-btn"><Icon name="filter" size={18}/></button>
    </div>

    <div style={{ padding: "0 16px 12px" }}>
      <div style={{
        background: "var(--surface-2)", border: "1px solid var(--border)",
        borderRadius: 12, padding: "10px 14px",
        display: "flex", alignItems: "center", gap: 10
      }}>
        <Icon name="search" size={16}/>
        <span style={{ flex: 1, fontSize: 14, color: "var(--text)" }}>トークン</span>
        <Icon name="x" size={14}/>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        <span className="chip" style={{ padding: "3px 9px", fontSize: 11.5 }}>from:松田</span>
        <span className="chip" style={{ padding: "3px 9px", fontSize: 11.5 }}>in:#design-review</span>
        <span className="chip" style={{ padding: "3px 9px", fontSize: 11.5 }}>has:📎</span>
      </div>
    </div>

    <div className="mob-body" style={{ paddingTop: 0 }}>
      <div className="mob-section-h" style={{ paddingTop: 4 }}>保存ビュー</div>
      <div style={{ display: "flex", gap: 8, padding: "0 16px 4px", overflow: "hidden" }}>
        <span style={{
          padding: "6px 12px", borderRadius: 999,
          background: "var(--accent)", color: "var(--accent-fg)",
          fontSize: 12.5, fontWeight: 600,
        }}>⭐ 自分宛・未対応</span>
        <span style={{
          padding: "6px 12px", borderRadius: 999,
          background: "var(--surface-2)", color: "var(--text-muted)",
          fontSize: 12.5, fontWeight: 500, border: "1px solid var(--border)",
        }}>レビュー待ち</span>
      </div>

      <div className="mob-section-h">結果 · 24件</div>

      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3, display: "flex", gap: 6 }}>
          <Icon name="hash" size={11}/>design-review · 11月3日 11:05
        </div>
        <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 2 }}>中村</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
          配色<mark style={{
            background: "oklch(0.92 0.13 95)", color: "oklch(0.3 0.06 75)",
            padding: "0 2px", borderRadius: 3
          }}>トークン</mark>は oklch(0.55 0.15 250) ベースに 1色のみ。
        </div>
      </div>

      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3, display: "flex", gap: 6 }}>
          <Icon name="hash" size={11}/>specs-q2 · 10月30日 16:21
        </div>
        <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 2 }}>松田 さくら</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
          v3.1の<mark style={{
            background: "oklch(0.92 0.13 95)", color: "oklch(0.3 0.06 75)",
            padding: "0 2px", borderRadius: 3
          }}>トークン</mark>を共有。新ブランド色に合わせてアクセント・状態色を調整。
        </div>
      </div>

      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3, display: "flex", gap: 6 }}>
          <Icon name="hash" size={11}/>design-review · 10月28日 14:02
        </div>
        <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 2 }}>大野 結衣 · 📎</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
          <mark style={{ background: "oklch(0.92 0.13 95)", color: "oklch(0.3 0.06 75)", padding: "0 2px", borderRadius: 3 }}>トークン</mark>のコントラスト検証結果。AA/AAA を全部満たしています。
        </div>
      </div>
    </div>

    <div className="mob-tabbar">
      <div className="mob-tab"><Icon name="inbox" size={20}/><span>受信箱</span></div>
      <div className="mob-tab"><Icon name="message" size={20}/><span>チャット</span></div>
      <div className="mob-tab" aria-current="true"><Icon name="search" size={20}/><span>検索</span></div>
      <div className="mob-tab"><Icon name="calendar" size={20}/><span>予定</span></div>
      <div className="mob-tab"><Icon name="user" size={20}/><span>自分</span></div>
    </div>
  </div>
);

window.MobHome = MobHome;
window.MobChannel = MobChannel;
window.MobSearch = MobSearch;
