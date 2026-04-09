import UIKit
import UniformTypeIdentifiers

class ShareViewController: UIViewController {

    // MARK: - State

    private var sharedURL = ""
    private var selectedBucket = "read"
    private var selectedRemind = 0

    // MARK: - UI

    private let dimView = UIView()
    private let cardView = UIView()
    private var cardBottom: NSLayoutConstraint!
    private let urlLabel = UILabel()
    private let memoField = UITextField()
    private var saveBtnRef: UIButton?
    private var bucketBtns: [UIButton] = []
    private var remindBtns: [UIButton] = []

    // MARK: - Colors

    private let fg = UIColor(white: 0.067, alpha: 1)
    private let pill = UIColor(white: 0.94, alpha: 1)
    private let labelGray = UIColor(white: 0.6, alpha: 1)
    private let fieldBg = UIColor(white: 0.96, alpha: 1)

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        view.isOpaque = false
        buildUI()
        extractURL()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        UIView.animate(withDuration: 0.32, delay: 0, usingSpringWithDamping: 0.92, initialSpringVelocity: 0.5, options: []) {
            self.dimView.alpha = 1
            self.cardBottom.constant = 0
            self.view.layoutIfNeeded()
        }
    }

    // MARK: - URL Extraction

    private func extractURL() {
        guard let items = extensionContext?.inputItems as? [NSExtensionItem] else { return }
        for item in items {
            guard let providers = item.attachments else { continue }
            for provider in providers {
                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    provider.loadItem(forTypeIdentifier: UTType.url.identifier) { [weak self] data, _ in
                        if let url = data as? URL {
                            DispatchQueue.main.async {
                                self?.sharedURL = url.absoluteString
                                self?.urlLabel.text = url.host ?? url.absoluteString
                            }
                        }
                    }
                    return
                }
                if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) { [weak self] data, _ in
                        if let text = data as? String,
                           let url = URL(string: text),
                           url.scheme?.hasPrefix("http") == true {
                            DispatchQueue.main.async {
                                self?.sharedURL = text
                                self?.urlLabel.text = url.host ?? text
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Build UI

    private func buildUI() {
        // Dim overlay
        dimView.backgroundColor = UIColor.black.withAlphaComponent(0.35)
        dimView.alpha = 0
        dimView.frame = view.bounds
        dimView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(dimView)
        dimView.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(closeTapped)))

        // Card
        cardView.backgroundColor = .white
        cardView.layer.cornerRadius = 20
        cardView.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        cardView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(cardView)

        cardBottom = cardView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: 500)
        NSLayoutConstraint.activate([
            cardView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            cardView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            cardBottom,
        ])

        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 0
        stack.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: cardView.topAnchor),
            stack.leadingAnchor.constraint(equalTo: cardView.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: cardView.trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: cardView.safeAreaLayoutGuide.bottomAnchor, constant: -12),
        ])

        stack.addArrangedSubview(makeHandle())
        stack.addArrangedSubview(makeHeader())
        stack.addArrangedSubview(makeURLBar())
        stack.addArrangedSubview(makeLabel("분류"))
        stack.addArrangedSubview(makeBucketRow())
        stack.addArrangedSubview(makeLabel("메모"))
        stack.addArrangedSubview(makeMemoRow())
        stack.addArrangedSubview(makeLabel("리마인드"))
        stack.addArrangedSubview(makeRemindRow())
        stack.addArrangedSubview(makeSpacer(16))
        stack.addArrangedSubview(makeSaveButton())
    }

    // MARK: - UI Builders

    private func makeHandle() -> UIView {
        let w = UIView()
        w.heightAnchor.constraint(equalToConstant: 16).isActive = true
        let bar = UIView()
        bar.backgroundColor = UIColor(white: 0.8, alpha: 1)
        bar.layer.cornerRadius = 2.5
        bar.translatesAutoresizingMaskIntoConstraints = false
        w.addSubview(bar)
        NSLayoutConstraint.activate([
            bar.centerXAnchor.constraint(equalTo: w.centerXAnchor),
            bar.centerYAnchor.constraint(equalTo: w.centerYAnchor),
            bar.widthAnchor.constraint(equalToConstant: 36),
            bar.heightAnchor.constraint(equalToConstant: 5),
        ])
        return w
    }

    private func makeHeader() -> UIView {
        let w = UIView()
        w.heightAnchor.constraint(equalToConstant: 44).isActive = true

        let title = UILabel()
        title.text = "insightful에 저장"
        title.font = .systemFont(ofSize: 17, weight: .bold)
        title.textColor = fg
        title.translatesAutoresizingMaskIntoConstraints = false
        w.addSubview(title)

        let close = UIButton(type: .system)
        close.setImage(UIImage(systemName: "xmark.circle.fill"), for: .normal)
        close.tintColor = UIColor(white: 0.75, alpha: 1)
        close.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        close.translatesAutoresizingMaskIntoConstraints = false
        w.addSubview(close)

        NSLayoutConstraint.activate([
            title.leadingAnchor.constraint(equalTo: w.leadingAnchor, constant: 20),
            title.centerYAnchor.constraint(equalTo: w.centerYAnchor),
            close.trailingAnchor.constraint(equalTo: w.trailingAnchor, constant: -16),
            close.centerYAnchor.constraint(equalTo: w.centerYAnchor),
            close.widthAnchor.constraint(equalToConstant: 28),
            close.heightAnchor.constraint(equalToConstant: 28),
        ])
        return w
    }

    private func makeURLBar() -> UIView {
        let w = UIView()
        w.heightAnchor.constraint(equalToConstant: 48).isActive = true

        let box = UIView()
        box.backgroundColor = fieldBg
        box.layer.cornerRadius = 10
        box.translatesAutoresizingMaskIntoConstraints = false
        w.addSubview(box)

        let icon = UIImageView(image: UIImage(systemName: "link"))
        icon.tintColor = labelGray
        icon.contentMode = .scaleAspectFit
        icon.translatesAutoresizingMaskIntoConstraints = false
        box.addSubview(icon)

        urlLabel.text = "URL 불러오는 중..."
        urlLabel.font = .systemFont(ofSize: 14, weight: .medium)
        urlLabel.textColor = UIColor(white: 0.4, alpha: 1)
        urlLabel.lineBreakMode = .byTruncatingMiddle
        urlLabel.translatesAutoresizingMaskIntoConstraints = false
        box.addSubview(urlLabel)

        NSLayoutConstraint.activate([
            box.leadingAnchor.constraint(equalTo: w.leadingAnchor, constant: 20),
            box.trailingAnchor.constraint(equalTo: w.trailingAnchor, constant: -20),
            box.topAnchor.constraint(equalTo: w.topAnchor),
            box.heightAnchor.constraint(equalToConstant: 40),
            icon.leadingAnchor.constraint(equalTo: box.leadingAnchor, constant: 12),
            icon.centerYAnchor.constraint(equalTo: box.centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 16),
            icon.heightAnchor.constraint(equalToConstant: 16),
            urlLabel.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 8),
            urlLabel.trailingAnchor.constraint(equalTo: box.trailingAnchor, constant: -12),
            urlLabel.centerYAnchor.constraint(equalTo: box.centerYAnchor),
        ])
        return w
    }

    private func makeLabel(_ text: String) -> UIView {
        let w = UIView()
        w.heightAnchor.constraint(equalToConstant: 32).isActive = true
        let lbl = UILabel()
        lbl.text = text
        lbl.font = .systemFont(ofSize: 13, weight: .semibold)
        lbl.textColor = labelGray
        lbl.translatesAutoresizingMaskIntoConstraints = false
        w.addSubview(lbl)
        NSLayoutConstraint.activate([
            lbl.leadingAnchor.constraint(equalTo: w.leadingAnchor, constant: 20),
            lbl.bottomAnchor.constraint(equalTo: w.bottomAnchor, constant: -4),
        ])
        return w
    }

    private func makeBucketRow() -> UIView {
        let w = UIView()
        w.heightAnchor.constraint(equalToConstant: 46).isActive = true
        let row = UIStackView()
        row.axis = .horizontal
        row.spacing = 8
        row.distribution = .fillEqually
        row.translatesAutoresizingMaskIntoConstraints = false
        w.addSubview(row)
        NSLayoutConstraint.activate([
            row.leadingAnchor.constraint(equalTo: w.leadingAnchor, constant: 20),
            row.trailingAnchor.constraint(equalTo: w.trailingAnchor, constant: -20),
            row.topAnchor.constraint(equalTo: w.topAnchor),
            row.heightAnchor.constraint(equalToConstant: 38),
        ])
        for (i, title) in ["읽을 거리", "해볼 거리"].enumerated() {
            let btn = makePill(title, tag: i)
            btn.addTarget(self, action: #selector(bucketTapped(_:)), for: .touchUpInside)
            row.addArrangedSubview(btn)
            bucketBtns.append(btn)
        }
        updateBucketUI()
        return w
    }

    private func makeMemoRow() -> UIView {
        let w = UIView()
        w.heightAnchor.constraint(equalToConstant: 50).isActive = true
        memoField.placeholder = "한 줄 메모를 남겨보세요"
        memoField.font = .systemFont(ofSize: 15)
        memoField.backgroundColor = fieldBg
        memoField.layer.cornerRadius = 10
        memoField.leftView = UIView(frame: CGRect(x: 0, y: 0, width: 14, height: 0))
        memoField.leftViewMode = .always
        memoField.rightView = UIView(frame: CGRect(x: 0, y: 0, width: 14, height: 0))
        memoField.rightViewMode = .always
        memoField.returnKeyType = .done
        memoField.delegate = self
        memoField.translatesAutoresizingMaskIntoConstraints = false
        w.addSubview(memoField)
        NSLayoutConstraint.activate([
            memoField.leadingAnchor.constraint(equalTo: w.leadingAnchor, constant: 20),
            memoField.trailingAnchor.constraint(equalTo: w.trailingAnchor, constant: -20),
            memoField.topAnchor.constraint(equalTo: w.topAnchor),
            memoField.heightAnchor.constraint(equalToConstant: 42),
        ])
        return w
    }

    private func makeRemindRow() -> UIView {
        let w = UIView()
        w.heightAnchor.constraint(equalToConstant: 46).isActive = true
        let row = UIStackView()
        row.axis = .horizontal
        row.spacing = 8
        row.distribution = .fillEqually
        row.translatesAutoresizingMaskIntoConstraints = false
        w.addSubview(row)
        NSLayoutConstraint.activate([
            row.leadingAnchor.constraint(equalTo: w.leadingAnchor, constant: 20),
            row.trailingAnchor.constraint(equalTo: w.trailingAnchor, constant: -20),
            row.topAnchor.constraint(equalTo: w.topAnchor),
            row.heightAnchor.constraint(equalToConstant: 38),
        ])
        for (i, title) in ["없음", "오늘 저녁", "내일 아침"].enumerated() {
            let btn = makePill(title, tag: i)
            btn.addTarget(self, action: #selector(remindTapped(_:)), for: .touchUpInside)
            row.addArrangedSubview(btn)
            remindBtns.append(btn)
        }
        updateRemindUI()
        return w
    }

    private func makeSaveButton() -> UIView {
        let w = UIView()
        w.heightAnchor.constraint(equalToConstant: 56).isActive = true
        let btn = UIButton(type: .system)
        btn.setTitle("저장하기", for: .normal)
        btn.titleLabel?.font = .systemFont(ofSize: 16, weight: .bold)
        btn.setTitleColor(.white, for: .normal)
        btn.backgroundColor = fg
        btn.layer.cornerRadius = 12
        btn.addTarget(self, action: #selector(saveTapped), for: .touchUpInside)
        btn.translatesAutoresizingMaskIntoConstraints = false
        w.addSubview(btn)
        saveBtnRef = btn
        NSLayoutConstraint.activate([
            btn.leadingAnchor.constraint(equalTo: w.leadingAnchor, constant: 20),
            btn.trailingAnchor.constraint(equalTo: w.trailingAnchor, constant: -20),
            btn.topAnchor.constraint(equalTo: w.topAnchor),
            btn.heightAnchor.constraint(equalToConstant: 50),
        ])
        return w
    }

    private func makePill(_ title: String, tag: Int) -> UIButton {
        let btn = UIButton(type: .system)
        btn.tag = tag
        btn.setTitle(title, for: .normal)
        btn.titleLabel?.font = .systemFont(ofSize: 14, weight: .semibold)
        btn.layer.cornerRadius = 19
        btn.clipsToBounds = true
        return btn
    }

    private func makeSpacer(_ h: CGFloat) -> UIView {
        let v = UIView()
        v.heightAnchor.constraint(equalToConstant: h).isActive = true
        return v
    }

    // MARK: - State Updates

    private func updateBucketUI() {
        let vals = ["read", "do"]
        for (i, btn) in bucketBtns.enumerated() {
            let on = vals[i] == selectedBucket
            btn.backgroundColor = on ? fg : pill
            btn.setTitleColor(on ? .white : UIColor(white: 0.4, alpha: 1), for: .normal)
        }
    }

    private func updateRemindUI() {
        for (i, btn) in remindBtns.enumerated() {
            let on = i == selectedRemind
            btn.backgroundColor = on ? fg : pill
            btn.setTitleColor(on ? .white : UIColor(white: 0.4, alpha: 1), for: .normal)
        }
    }

    // MARK: - Actions

    @objc private func bucketTapped(_ sender: UIButton) {
        selectedBucket = sender.tag == 0 ? "read" : "do"
        updateBucketUI()
    }

    @objc private func remindTapped(_ sender: UIButton) {
        selectedRemind = sender.tag
        updateRemindUI()
    }

    @objc private func closeTapped() {
        memoField.resignFirstResponder()
        animateOut {
            self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        }
    }

    @objc private func saveTapped() {
        guard !sharedURL.isEmpty else { return }

        // Save to App Groups
        let defaults = UserDefaults(suiteName: "group.com.juny.insightful")
        var pending = defaults?.array(forKey: "pendingScraps") as? [[String: String]] ?? []

        var remindAt = ""
        let cal = Calendar.current
        let now = Date()
        let fmt = ISO8601DateFormatter()
        switch selectedRemind {
        case 1:
            if let t = cal.date(bySettingHour: 20, minute: 0, second: 0, of: now) {
                remindAt = fmt.string(from: t)
            }
        case 2:
            if let d = cal.date(byAdding: .day, value: 1, to: now),
               let m = cal.date(bySettingHour: 9, minute: 0, second: 0, of: d) {
                remindAt = fmt.string(from: m)
            }
        default: break
        }

        pending.append([
            "url": sharedURL,
            "bucket": selectedBucket,
            "memo": memoField.text ?? "",
            "remindAt": remindAt,
            "createdAt": fmt.string(from: now),
        ])
        defaults?.set(pending, forKey: "pendingScraps")

        // Success feedback
        memoField.resignFirstResponder()
        saveBtnRef?.setTitle("저장됨", for: .normal)
        saveBtnRef?.backgroundColor = UIColor.systemGreen
        saveBtnRef?.isEnabled = false

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.animateOut {
                self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
            }
        }
    }

    private func animateOut(completion: @escaping () -> Void) {
        UIView.animate(withDuration: 0.25, delay: 0, options: .curveEaseIn, animations: {
            self.dimView.alpha = 0
            self.cardBottom.constant = 500
            self.view.layoutIfNeeded()
        }, completion: { _ in completion() })
    }
}

// MARK: - UITextFieldDelegate

extension ShareViewController: UITextFieldDelegate {
    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        textField.resignFirstResponder()
        return true
    }
}
