import Foundation

@objc(InsightfulPendingQueue)
class InsightfulPendingQueue: NSObject {

    private static let suiteName = "group.com.juny.insightful"
    private static let pendingKey = "pendingScraps"
    private static let tagPoolKey = "tagPool"

    @objc func getPending(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let defaults = UserDefaults(suiteName: Self.suiteName) else {
            resolve([])
            return
        }
        let items = defaults.array(forKey: Self.pendingKey) as? [[String: String]] ?? []
        resolve(items)
    }

    @objc func clearPending(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let defaults = UserDefaults(suiteName: Self.suiteName) else {
            resolve(NSNull())
            return
        }
        defaults.removeObject(forKey: Self.pendingKey)
        resolve(NSNull())
    }

    @objc func setTagPool(
        _ tags: [String],
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let defaults = UserDefaults(suiteName: Self.suiteName) else {
            resolve(NSNull())
            return
        }
        defaults.set(tags, forKey: Self.tagPoolKey)
        resolve(NSNull())
    }

    @objc static func requiresMainQueueSetup() -> Bool {
        return false
    }
}
