# metis

This is a Chrome extension that allows an AI advisor to join Google Meet.

## 機能

- Google Meet の会議に AIアドバイザーを追加し
- 音声認識により「メーティス」に向けたあなたの質問に生成AIで回答を作成し、チャットに記載します

## インストール

1. このリポジトリをクローンします。
   ```sh
   git clone https://github.com/uskithub/metis.git
   ```

2. 依存関係をインストールします
   ```sh
   cd metis
   yarn
   ```

## ビルド
プロジェクトをビルドするには、以下のコマンドを実行します。
   ```sh
   yarn build
   ```

## 使用方法

1. Chrome拡張機能の管理ページ（chrome://extensions/）を開きます。
2. デベロッパーモードのスイッチを ON にし、「パッケージ化されていない拡張機能を読み込む」ボタンをクリックし、ビルドして作成された distフォルダを選択します。
3. Google Meetを開き、Metis が動作することを確認します。