#!/bin/sh

# Xcode Cloud의 macOS 이미지에는 Node가 기본 탑재되어 있지 않다.
# Expo + React Native의 Podfile은 Pod 해석 단계에서 `node --print "require.resolve(...)"`
# 같은 호출을 하기 때문에, pod install 이전에 Node + JS 의존성을 먼저 준비해야 한다.

set -euxo pipefail

# 1) Node.js 설치 (Xcode Cloud 머신엔 Homebrew가 기본 포함됨)
brew install node

# 2) 저장소 루트로 이동 후 JS 의존성 설치
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm ci

# 3) CocoaPods 설치 (ios/ 디렉터리에서 실행해야 Podfile을 인식)
cd ios
pod install
