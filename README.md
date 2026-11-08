# IcTools ワープロ検定シミュレーター

日本語ワープロ検定（速度部門・文書作成部門）の練習用ツール＋キー配列を覚えるタイピング練習（イージータイピスト）。
非公式の練習用ツールです。日本情報処理検定協会とは無関係です。

現在のバージョン: v0.7.1（ベータ）

## 構成

```
index.html      画面（HTML）
css/style.css   スタイル
js/texts.js     課題文・タイピングお題の既定データ
js/store.js     入力文の保存・取得（localStorage）
js/admin.js     入力文の管理画面
js/app.js       本体のロジック
```

## GitHub Pages で公開する

1. このフォルダ全体を GitHub リポジトリに push
2. Settings → Pages → Source を「Deploy from a branch」、Branch を `main` / `/ (root)` にして Save
3. 数分後に `https://<ユーザー名>.github.io/<リポジトリ名>/` で動く

ローカルでは `index.html` をブラウザで開くだけで動きます（サーバー不要）。

## 使用ライブラリ

外部ライブラリ・外部通信なし（ブラウザ標準機能のみ）。

## ライセンス

未設定（公開前に決めてください）。
