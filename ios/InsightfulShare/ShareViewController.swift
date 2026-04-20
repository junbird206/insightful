import UIKit
import UniformTypeIdentifiers

class ShareViewController: UIViewController {

    // MARK: - State

    private var sharedURL = ""
    private var selectedBucket = "read"
    private var memoTouched = false

    // Tags
    private var tagPool: [String] = []
    private var selectedTags: Set<String> = []

    // Remind
    private var selectedRemind = 0  // 0 = none, 1 = tonight, 2 = tomorrow morning
    private var remindDate: Date?

    // MARK: - UI refs

    private let dimView = UIView()
    private let cardView = UIView()
    private var cardBottom: NSLayoutConstraint!

    private let urlLabel = UILabel()
    private let memoField = UITextField()
    private var saveBtnRef: UIButton?

    private var bucketBtns: [UIButton] = []
    private var remindBtns: [UIButton] = []

    // Tag section
    private var tagScrollView: UIScrollView!
    private var tagStackView: UIStackView!

    // Remind section — picker + preview always in hierarchy, toggled via isHidden
    private var remindPreviewLabel: UILabel!
    private var remindPickerContainer: UIView!
    private var remindPickerView: UIPickerView!
    private var pastTimeWarningLabel: UILabel!

    // Picker data
    private var dateOptions: [(label: String, year: Int, month: Int, day: Int)] = []
    private let ampmOptions = ["오전", "오후"]
    private let hourOptions = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    private let minuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

    private var pickerDateIdx = 0
    private var pickerAmpmIdx = 1
    private var pickerHour = 6
    private var pickerMinute = 0

    // MARK: - Colors (matching Add screen)

    private let fg = UIColor(red: 0.067, green: 0.067, blue: 0.067, alpha: 1)        // #111111
    private let chipBg = UIColor(red: 0.941, green: 0.941, blue: 0.941, alpha: 1)     // #F0F0F0
    private let chipText = UIColor(red: 0.533, green: 0.533, blue: 0.533, alpha: 1)   // #888888
    private let labelColor = UIColor(red: 0.4, green: 0.4, blue: 0.4, alpha: 1)       // #666666
    private let fieldBg = UIColor(red: 0.96, green: 0.96, blue: 0.96, alpha: 1)
    private let optionalColor = UIColor(red: 0.6, green: 0.6, blue: 0.6, alpha: 1)    // #999999
    private let borderColor = UIColor(red: 0.91, green: 0.91, blue: 0.91, alpha: 1)   // #E8E8E8

    // MARK: - Constants

    private static let suiteName = "group.com.juny.insightful"
    private static let tagPoolKey = "tagPool"

    // Match Add screen preset times
    private static let tonightHour = 18
    private static let tomorrowMorningHour = 8

    // MARK: - Date option generation

    private func generateDateOptions() {
        let today = Calendar.current.startOfDay(for: Date())
        dateOptions = (0..<30).map { i in
            let d = Calendar.current.date(byAdding: .day, value: i, to: today)!
            let label: String
            if i == 0 { label = "오늘" }
            else if i == 1 { label = "내일" }
            else { label = "\(Calendar.current.component(.month, from: d))/\(Calendar.current.component(.day, from: d))" }
            return (label: label,
                    year: Calendar.current.component(.year, from: d),
                    month: Calendar.current.component(.month, from: d) - 1,
                    day: Calendar.current.component(.day, from: d))
        }
    }

    private func pickerToDate() -> Date {
        let opt = dateOptions[pickerDateIdx]
        var hour24 = pickerHour
        if pickerAmpmIdx == 0 { // 오전
            if pickerHour == 12 { hour24 = 0 }
        } else { // 오후
            if pickerHour != 12 { hour24 = pickerHour + 12 }
        }
        var comps = DateComponents()
        comps.year = opt.year
        comps.month = opt.month + 1
        comps.day = opt.day
        comps.hour = hour24
        comps.minute = pickerMinute
        return Calendar.current.date(from: comps) ?? Date()
    }

    private func setPickerFromDate(_ date: Date) {
        let cal = Calendar.current
        // Find date index
        let targetDay = cal.startOfDay(for: date)
        let today = cal.startOfDay(for: Date())
        let dayDiff = cal.dateComponents([.day], from: today, to: targetDay).day ?? 0
        pickerDateIdx = max(0, min(dayDiff, dateOptions.count - 1))

        let h = cal.component(.hour, from: date)
        pickerAmpmIdx = h < 12 ? 0 : 1
        pickerHour = h == 0 ? 12 : (h > 12 ? h - 12 : h)
        pickerMinute = (cal.component(.minute, from: date) / 5) * 5

        remindPickerView?.selectRow(pickerDateIdx, inComponent: 0, animated: false)
        remindPickerView?.selectRow(pickerAmpmIdx, inComponent: 1, animated: false)
        if let hourIdx = hourOptions.firstIndex(of: pickerHour) {
            remindPickerView?.selectRow(hourIdx, inComponent: 2, animated: false)
        }
        if let minIdx = minuteOptions.firstIndex(of: pickerMinute) {
            remindPickerView?.selectRow(minIdx, inComponent: 3, animated: false)
        }
    }

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        view.isOpaque = false
        loadTagPool()
        generateDateOptions()
        buildUI()
        extractURL()

        NotificationCenter.default.addObserver(
            self, selector: #selector(keyboardWillChangeFrame(_:)),
            name: UIResponder.keyboardWillChangeFrameNotification, object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        UIView.animate(withDuration: 0.32, delay: 0,
                       usingSpringWithDamping: 0.92,
                       initialSpringVelocity: 0.5, options: []) {
            self.dimView.alpha = 1
            self.cardBottom.constant = 0
            self.view.layoutIfNeeded()
        }
    }

    // MARK: - Keyboard Avoidance

    @objc private func keyboardWillChangeFrame(_ note: Notification) {
        guard let endFrame = note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect,
              let duration = note.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? TimeInterval,
              let curveRaw = note.userInfo?[UIResponder.keyboardAnimationCurveUserInfoKey] as? UInt
        else { return }

        // Keyboard below screen bottom → hiding; otherwise → showing
        let screenH = view.bounds.height
        let keyboardVisible = endFrame.origin.y < screenH
        let offset: CGFloat = keyboardVisible ? -(screenH - endFrame.origin.y) : 0

        cardBottom.constant = offset

        UIView.animate(withDuration: duration, delay: 0,
                       options: UIView.AnimationOptions(rawValue: curveRaw << 16)) {
            self.view.layoutIfNeeded()
        }
    }

    // MARK: - Tag Pool (App Groups UserDefaults)

    private func loadTagPool() {
        guard let defaults = UserDefaults(suiteName: Self.suiteName) else { return }
        tagPool = defaults.stringArray(forKey: Self.tagPoolKey) ?? []
    }

    private func persistTagPool() {
        guard let defaults = UserDefaults(suiteName: Self.suiteName) else { return }
        defaults.set(tagPool, forKey: Self.tagPoolKey)
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

        // Bottom card
        cardView.backgroundColor = .white
        cardView.layer.cornerRadius = 20
        cardView.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        cardView.clipsToBounds = true
        cardView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(cardView)

        cardBottom = cardView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: 600)
        NSLayoutConstraint.activate([
            cardView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            cardView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            cardBottom,
        ])

        // Card must not extend above safe area (allows scroll when content is tall)
        cardView.topAnchor.constraint(
            greaterThanOrEqualTo: view.safeAreaLayoutGuide.topAnchor, constant: 20
        ).isActive = true

        // Scroll view inside card
        let scrollView = UIScrollView()
        scrollView.alwaysBounceVertical = false
        scrollView.keyboardDismissMode = .interactive
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(scrollView)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: cardView.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: cardView.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: cardView.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: cardView.safeAreaLayoutGuide.bottomAnchor),
        ])

        // Content stack inside scroll view
        let contentStack = UIStackView()
        contentStack.axis = .vertical
        contentStack.spacing = 0
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(contentStack)

        NSLayoutConstraint.activate([
            contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            contentStack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            contentStack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            contentStack.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor),
        ])

        // ScrollView frame height tracks content (card hugs content)
        // Priority < required so it can shrink when card hits max height → scroll enabled
        let heightMatch = scrollView.frameLayoutGuide.heightAnchor.constraint(
            equalTo: contentStack.heightAnchor
        )
        heightMatch.priority = .defaultHigh
        heightMatch.isActive = true

        // Assemble sections — order matches Add screen
        contentStack.addArrangedSubview(makeHandle())
        contentStack.addArrangedSubview(makeHeader())
        contentStack.addArrangedSubview(makeURLBar())

        contentStack.addArrangedSubview(makeSectionLabel("분류"))
        contentStack.addArrangedSubview(makeBucketSection())

        contentStack.addArrangedSubview(makeSectionLabel("태그", optional: true))
        contentStack.addArrangedSubview(makeTagSection())

        contentStack.addArrangedSubview(makeSectionLabel("메모", optional: true))
        contentStack.addArrangedSubview(makeMemoSection())

        contentStack.addArrangedSubview(makeSectionLabel("리마인드", optional: true))
        contentStack.addArrangedSubview(makeRemindSection())

        contentStack.addArrangedSubview(makeSpacer(20))
        contentStack.addArrangedSubview(makeSaveButton())
        contentStack.addArrangedSubview(makeSpacer(12))
    }

    // MARK: - Handle + Header

    private func makeHandle() -> UIView {
        let wrapper = UIView()
        wrapper.heightAnchor.constraint(equalToConstant: 16).isActive = true

        let bar = UIView()
        bar.backgroundColor = UIColor(white: 0.8, alpha: 1)
        bar.layer.cornerRadius = 2.5
        bar.translatesAutoresizingMaskIntoConstraints = false
        wrapper.addSubview(bar)

        NSLayoutConstraint.activate([
            bar.centerXAnchor.constraint(equalTo: wrapper.centerXAnchor),
            bar.centerYAnchor.constraint(equalTo: wrapper.centerYAnchor),
            bar.widthAnchor.constraint(equalToConstant: 36),
            bar.heightAnchor.constraint(equalToConstant: 5),
        ])
        return wrapper
    }

    private func makeHeader() -> UIView {
        let wrapper = UIView()
        wrapper.heightAnchor.constraint(equalToConstant: 44).isActive = true

        let title = UILabel()
        title.text = "insightful에 저장"
        title.font = .systemFont(ofSize: 17, weight: .bold)
        title.textColor = fg
        title.translatesAutoresizingMaskIntoConstraints = false
        wrapper.addSubview(title)

        let close = UIButton(type: .system)
        close.setImage(UIImage(systemName: "xmark.circle.fill"), for: .normal)
        close.tintColor = UIColor(white: 0.75, alpha: 1)
        close.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        close.translatesAutoresizingMaskIntoConstraints = false
        wrapper.addSubview(close)

        NSLayoutConstraint.activate([
            title.leadingAnchor.constraint(equalTo: wrapper.leadingAnchor, constant: 20),
            title.centerYAnchor.constraint(equalTo: wrapper.centerYAnchor),
            close.trailingAnchor.constraint(equalTo: wrapper.trailingAnchor, constant: -16),
            close.centerYAnchor.constraint(equalTo: wrapper.centerYAnchor),
            close.widthAnchor.constraint(equalToConstant: 28),
            close.heightAnchor.constraint(equalToConstant: 28),
        ])
        return wrapper
    }

    // MARK: - URL Bar

    private func makeURLBar() -> UIView {
        let wrapper = UIView()
        wrapper.heightAnchor.constraint(equalToConstant: 48).isActive = true

        let box = UIView()
        box.backgroundColor = .white
        box.layer.cornerRadius = 8
        box.layer.borderWidth = 1
        box.layer.borderColor = borderColor.cgColor
        box.translatesAutoresizingMaskIntoConstraints = false
        wrapper.addSubview(box)

        let icon = UIImageView(image: UIImage(systemName: "link"))
        icon.tintColor = labelColor
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
            box.leadingAnchor.constraint(equalTo: wrapper.leadingAnchor, constant: 20),
            box.trailingAnchor.constraint(equalTo: wrapper.trailingAnchor, constant: -20),
            box.topAnchor.constraint(equalTo: wrapper.topAnchor),
            box.heightAnchor.constraint(equalToConstant: 40),
            icon.leadingAnchor.constraint(equalTo: box.leadingAnchor, constant: 12),
            icon.centerYAnchor.constraint(equalTo: box.centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 16),
            icon.heightAnchor.constraint(equalToConstant: 16),
            urlLabel.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 8),
            urlLabel.trailingAnchor.constraint(equalTo: box.trailingAnchor, constant: -12),
            urlLabel.centerYAnchor.constraint(equalTo: box.centerYAnchor),
        ])
        return wrapper
    }

    // MARK: - Section Labels (matching Add screen style)

    private func makeSectionLabel(_ text: String, optional: Bool = false) -> UIView {
        let wrapper = UIView()
        wrapper.heightAnchor.constraint(equalToConstant: 34).isActive = true

        let label = UILabel()
        label.font = .systemFont(ofSize: 12, weight: .semibold)
        label.textColor = labelColor
        label.translatesAutoresizingMaskIntoConstraints = false

        if optional {
            let main = NSMutableAttributedString(
                string: text + " ",
                attributes: [
                    .font: UIFont.systemFont(ofSize: 12, weight: .semibold),
                    .foregroundColor: labelColor,
                ]
            )
            main.append(NSAttributedString(
                string: "(선택)",
                attributes: [
                    .font: UIFont.systemFont(ofSize: 12, weight: .regular),
                    .foregroundColor: optionalColor,
                ]
            ))
            label.attributedText = main
        } else {
            label.text = text
        }

        wrapper.addSubview(label)
        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: wrapper.leadingAnchor, constant: 20),
            label.bottomAnchor.constraint(equalTo: wrapper.bottomAnchor, constant: -6),
        ])
        return wrapper
    }

    // MARK: - Bucket Section

    private func makeBucketSection() -> UIView {
        let wrapper = UIView()
        wrapper.heightAnchor.constraint(equalToConstant: 48).isActive = true

        let row = UIStackView()
        row.axis = .horizontal
        row.spacing = 10
        row.distribution = .fillEqually
        row.translatesAutoresizingMaskIntoConstraints = false
        wrapper.addSubview(row)

        NSLayoutConstraint.activate([
            row.leadingAnchor.constraint(equalTo: wrapper.leadingAnchor, constant: 20),
            row.trailingAnchor.constraint(equalTo: wrapper.trailingAnchor, constant: -20),
            row.topAnchor.constraint(equalTo: wrapper.topAnchor),
            row.heightAnchor.constraint(equalToConstant: 44),
        ])

        // Match Add screen labels
        for (i, title) in ["📖 To Read", "⚡ To Do"].enumerated() {
            let btn = UIButton(type: .system)
            btn.setTitle(title, for: .normal)
            btn.titleLabel?.font = .systemFont(ofSize: 13, weight: .semibold)
            btn.clipsToBounds = true
            btn.tag = i
            btn.layer.cornerRadius = 8
            btn.contentEdgeInsets = UIEdgeInsets(top: 12, left: 12, bottom: 12, right: 12)
            btn.layer.borderWidth = 1
            btn.layer.borderColor = borderColor.cgColor
            btn.addTarget(self, action: #selector(bucketTapped(_:)), for: .touchUpInside)
            row.addArrangedSubview(btn)
            bucketBtns.append(btn)
        }
        updateBucketUI()
        return wrapper
    }

    // MARK: - Tag Section (always present)

    private func makeTagSection() -> UIView {
        let wrapper = UIView()
        wrapper.heightAnchor.constraint(equalToConstant: 44).isActive = true

        let scroll = UIScrollView()
        scroll.showsHorizontalScrollIndicator = false
        scroll.translatesAutoresizingMaskIntoConstraints = false
        wrapper.addSubview(scroll)
        tagScrollView = scroll

        let row = UIStackView()
        row.axis = .horizontal
        row.spacing = 8
        row.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(row)
        tagStackView = row

        NSLayoutConstraint.activate([
            scroll.leadingAnchor.constraint(equalTo: wrapper.leadingAnchor, constant: 20),
            scroll.trailingAnchor.constraint(equalTo: wrapper.trailingAnchor, constant: -20),
            scroll.topAnchor.constraint(equalTo: wrapper.topAnchor),
            scroll.heightAnchor.constraint(equalToConstant: 36),
            row.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor),
            row.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor),
            row.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
            row.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor),
            row.heightAnchor.constraint(equalTo: scroll.frameLayoutGuide.heightAnchor),
        ])

        rebuildTagChips()
        return wrapper
    }

    private func rebuildTagChips() {
        guard let row = tagStackView else { return }
        row.arrangedSubviews.forEach { $0.removeFromSuperview() }

        for tag in tagPool {
            let btn = makeTagChip("#\(tag)", selected: selectedTags.contains(tag))
            btn.addTarget(self, action: #selector(tagTapped(_:)), for: .touchUpInside)
            row.addArrangedSubview(btn)
        }

        // Always show the "+ 추가" button
        let addBtn = makeTagChip("+ 추가", selected: false)
        addBtn.backgroundColor = UIColor(white: 0.88, alpha: 1)
        addBtn.setTitleColor(UIColor(white: 0.35, alpha: 1), for: .normal)
        addBtn.addTarget(self, action: #selector(addTagTapped), for: .touchUpInside)
        row.addArrangedSubview(addBtn)
    }

    private func makeTagChip(_ title: String, selected: Bool) -> UIButton {
        let btn = UIButton(type: .system)
        btn.setTitle(title, for: .normal)
        btn.titleLabel?.font = .systemFont(ofSize: 13, weight: .medium)
        btn.layer.cornerRadius = 16
        btn.clipsToBounds = true
        btn.contentEdgeInsets = UIEdgeInsets(top: 8, left: 14, bottom: 8, right: 14)
        btn.backgroundColor = selected ? fg : chipBg
        btn.setTitleColor(selected ? .white : chipText, for: .normal)
        return btn
    }

    // MARK: - Memo Section

    private func makeMemoSection() -> UIView {
        let wrapper = UIView()
        wrapper.heightAnchor.constraint(equalToConstant: 60).isActive = true

        memoField.text = suggestedMemo()
        memoField.textColor = UIColor(white: 0.67, alpha: 1)  // gray placeholder-like
        memoField.font = .systemFont(ofSize: 15)
        memoField.backgroundColor = .white
        memoField.layer.cornerRadius = 8
        memoField.layer.borderWidth = 1
        memoField.layer.borderColor = borderColor.cgColor
        memoField.leftView = UIView(frame: CGRect(x: 0, y: 0, width: 16, height: 0))
        memoField.leftViewMode = .always
        memoField.rightView = UIView(frame: CGRect(x: 0, y: 0, width: 16, height: 0))
        memoField.rightViewMode = .always
        memoField.returnKeyType = .done
        memoField.delegate = self
        memoField.translatesAutoresizingMaskIntoConstraints = false
        wrapper.addSubview(memoField)

        NSLayoutConstraint.activate([
            memoField.leadingAnchor.constraint(equalTo: wrapper.leadingAnchor, constant: 20),
            memoField.trailingAnchor.constraint(equalTo: wrapper.trailingAnchor, constant: -20),
            memoField.topAnchor.constraint(equalTo: wrapper.topAnchor),
            memoField.heightAnchor.constraint(equalToConstant: 48),
        ])
        return wrapper
    }

    // MARK: - Remind Section (self-contained: presets + preview + picker)

    private func makeRemindSection() -> UIView {
        // This vertical stack contains everything for remind — no dynamic insertion
        let section = UIStackView()
        section.axis = .vertical
        section.spacing = 8

        // 1. Preset chips (horizontal scroll — matching Add screen remindRow)
        let presetScroll = UIScrollView()
        presetScroll.showsHorizontalScrollIndicator = false
        presetScroll.translatesAutoresizingMaskIntoConstraints = false

        let presetRow = UIStackView()
        presetRow.axis = .horizontal
        presetRow.spacing = 8
        presetRow.translatesAutoresizingMaskIntoConstraints = false
        presetScroll.addSubview(presetRow)

        NSLayoutConstraint.activate([
            presetRow.leadingAnchor.constraint(equalTo: presetScroll.contentLayoutGuide.leadingAnchor),
            presetRow.trailingAnchor.constraint(equalTo: presetScroll.contentLayoutGuide.trailingAnchor),
            presetRow.topAnchor.constraint(equalTo: presetScroll.contentLayoutGuide.topAnchor),
            presetRow.bottomAnchor.constraint(equalTo: presetScroll.contentLayoutGuide.bottomAnchor),
            presetRow.heightAnchor.constraint(equalTo: presetScroll.frameLayoutGuide.heightAnchor),
        ])

        for (i, title) in ["없음", "오늘 저녁", "내일 아침"].enumerated() {
            let btn = UIButton(type: .system)
            btn.setTitle(title, for: .normal)
            btn.titleLabel?.font = .systemFont(ofSize: 13, weight: .medium)
            btn.layer.cornerRadius = 16
            btn.clipsToBounds = true
            btn.contentEdgeInsets = UIEdgeInsets(top: 8, left: 14, bottom: 8, right: 14)
            btn.tag = i
            btn.addTarget(self, action: #selector(remindTapped(_:)), for: .touchUpInside)
            presetRow.addArrangedSubview(btn)
            remindBtns.append(btn)
        }
        updateRemindUI()

        let presetWrapper = UIView()
        presetWrapper.heightAnchor.constraint(equalToConstant: 36).isActive = true
        presetWrapper.addSubview(presetScroll)
        NSLayoutConstraint.activate([
            presetScroll.leadingAnchor.constraint(equalTo: presetWrapper.leadingAnchor, constant: 20),
            presetScroll.trailingAnchor.constraint(equalTo: presetWrapper.trailingAnchor, constant: -20),
            presetScroll.topAnchor.constraint(equalTo: presetWrapper.topAnchor),
            presetScroll.bottomAnchor.constraint(equalTo: presetWrapper.bottomAnchor),
        ])
        section.addArrangedSubview(presetWrapper)

        // 2. Preview label (e.g. "🔔 오늘 오후 6시") — hidden by default
        let preview = UILabel()
        preview.font = .systemFont(ofSize: 12)
        preview.textColor = chipText
        preview.isHidden = true
        preview.translatesAutoresizingMaskIntoConstraints = false
        remindPreviewLabel = preview

        let previewWrapper = UIView()
        previewWrapper.addSubview(preview)
        NSLayoutConstraint.activate([
            preview.leadingAnchor.constraint(equalTo: previewWrapper.leadingAnchor, constant: 20),
            preview.trailingAnchor.constraint(equalTo: previewWrapper.trailingAnchor, constant: -20),
            preview.topAnchor.constraint(equalTo: previewWrapper.topAnchor),
            preview.bottomAnchor.constraint(equalTo: previewWrapper.bottomAnchor),
        ])
        section.addArrangedSubview(previewWrapper)

        // 3. Custom 4-column picker (matching Add screen RemindPicker)
        let container = UIView()
        container.backgroundColor = UIColor(red: 0.969, green: 0.969, blue: 0.969, alpha: 1) // #F7F7F7
        container.layer.cornerRadius = 12
        container.clipsToBounds = true
        container.isHidden = true
        container.translatesAutoresizingMaskIntoConstraints = false
        remindPickerContainer = container

        let pickerView = UIPickerView()
        pickerView.dataSource = self
        pickerView.delegate = self
        pickerView.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(pickerView)
        remindPickerView = pickerView

        NSLayoutConstraint.activate([
            pickerView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            pickerView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            pickerView.topAnchor.constraint(equalTo: container.topAnchor),
            pickerView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])

        let pickerWrapper = UIView()
        pickerWrapper.addSubview(container)
        NSLayoutConstraint.activate([
            container.leadingAnchor.constraint(equalTo: pickerWrapper.leadingAnchor, constant: 20),
            container.trailingAnchor.constraint(equalTo: pickerWrapper.trailingAnchor, constant: -20),
            container.topAnchor.constraint(equalTo: pickerWrapper.topAnchor),
            container.bottomAnchor.constraint(equalTo: pickerWrapper.bottomAnchor),
            container.heightAnchor.constraint(equalToConstant: 180),
        ])
        section.addArrangedSubview(pickerWrapper)

        return section
    }

    // MARK: - Save button

    private func makeSaveButton() -> UIView {
        let wrapper = UIView()
        wrapper.heightAnchor.constraint(equalToConstant: 76).isActive = true

        // Warning label above save button
        let warning = UILabel()
        warning.text = "현재 시각 이후로 설정해주세요"
        warning.font = .systemFont(ofSize: 12, weight: .regular)
        warning.textColor = UIColor(red: 0.863, green: 0.149, blue: 0.149, alpha: 1) // #DC2626
        warning.textAlignment = .left
        warning.isHidden = true
        warning.translatesAutoresizingMaskIntoConstraints = false
        wrapper.addSubview(warning)
        pastTimeWarningLabel = warning

        let btn = UIButton(type: .system)
        btn.setTitle("저장", for: .normal)
        btn.titleLabel?.font = .systemFont(ofSize: 15, weight: .bold)
        btn.setTitleColor(.white, for: .normal)
        btn.backgroundColor = fg
        btn.layer.cornerRadius = 8
        btn.addTarget(self, action: #selector(saveTapped), for: .touchUpInside)
        btn.translatesAutoresizingMaskIntoConstraints = false
        wrapper.addSubview(btn)
        saveBtnRef = btn

        NSLayoutConstraint.activate([
            warning.leadingAnchor.constraint(equalTo: wrapper.leadingAnchor, constant: 20),
            warning.trailingAnchor.constraint(equalTo: wrapper.trailingAnchor, constant: -20),
            warning.topAnchor.constraint(equalTo: wrapper.topAnchor),

            btn.leadingAnchor.constraint(equalTo: wrapper.leadingAnchor, constant: 20),
            btn.trailingAnchor.constraint(equalTo: wrapper.trailingAnchor, constant: -20),
            btn.topAnchor.constraint(equalTo: warning.bottomAnchor, constant: 4),
            btn.heightAnchor.constraint(equalToConstant: 50),
        ])
        return wrapper
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
            btn.backgroundColor = on ? fg : .white
            btn.setTitleColor(on ? .white : optionalColor, for: .normal)
            btn.layer.borderColor = on ? fg.cgColor : borderColor.cgColor
        }
    }

    private func updateRemindUI() {
        for (i, btn) in remindBtns.enumerated() {
            let on = i == selectedRemind
            btn.backgroundColor = on ? fg : chipBg
            btn.setTitleColor(on ? .white : chipText, for: .normal)
        }
    }

    // MARK: - Suggested Memo (matching Add screen's generateSuggestedMemo)

    private func suggestedMemo() -> String {
        let suffix = selectedBucket == "read" ? "읽어보기" : "실천해보기"

        if !selectedTags.isEmpty {
            let tagStr = selectedTags.map { "#\($0)" }.joined(separator: " ")
            return "\(tagStr) 관련 — \(suffix)"
        }
        return selectedBucket == "read" ? "나중에 다시 읽어볼 글" : "나중에 실행해볼 것"
    }

    private func updateSuggestedMemo() {
        guard !memoTouched else { return }
        memoField.text = suggestedMemo()
        memoField.textColor = UIColor(white: 0.67, alpha: 1)
    }

    // MARK: - Remind preview label formatting (matching Add screen's formatRemindLabel)

    private func formatRemindLabel(_ date: Date) -> String {
        let now = Date()
        let cal = Calendar.current

        let isToday = cal.isDateInToday(date)
        let isTomorrow = cal.isDateInTomorrow(date)

        let h = cal.component(.hour, from: date)
        let m = cal.component(.minute, from: date)
        let period = h < 12 ? "오전" : "오후"
        let hour12 = h == 0 ? 12 : (h > 12 ? h - 12 : h)
        let time = m == 0 ? "\(period) \(hour12)시" : "\(period) \(hour12):\(String(format: "%02d", m))"

        if isToday { return "오늘 \(time)" }
        if isTomorrow { return "내일 \(time)" }

        let month = cal.component(.month, from: date)
        let day = cal.component(.day, from: date)
        let weekdays = ["일", "월", "화", "수", "목", "금", "토"]
        let weekday = weekdays[cal.component(.weekday, from: date) - 1]
        return "\(month)/\(day)(\(weekday)) \(time)"
    }

    private func updateRemindPreview() {
        if let date = remindDate {
            remindPreviewLabel.text = "🔔 \(formatRemindLabel(date))"
            remindPreviewLabel.isHidden = false
            remindPreviewLabel.superview?.isHidden = false
        } else {
            remindPreviewLabel.isHidden = true
            remindPreviewLabel.superview?.isHidden = true
        }
    }

    // MARK: - Actions

    @objc private func bucketTapped(_ sender: UIButton) {
        selectedBucket = sender.tag == 0 ? "read" : "do"
        updateBucketUI()
        updateSuggestedMemo()
    }

    @objc private func tagTapped(_ sender: UIButton) {
        guard let title = sender.currentTitle?.replacingOccurrences(of: "#", with: "") else { return }
        if selectedTags.contains(title) {
            selectedTags.remove(title)
        } else {
            selectedTags.insert(title)
        }
        rebuildTagChips()
        updateSuggestedMemo()
    }

    @objc private func addTagTapped() {
        let alert = UIAlertController(title: "새 태그 추가", message: nil, preferredStyle: .alert)
        alert.addTextField { $0.placeholder = "태그 이름" }
        alert.addAction(UIAlertAction(title: "취소", style: .cancel))
        alert.addAction(UIAlertAction(title: "추가", style: .default) { [weak self] _ in
            guard let self = self,
                  let text = alert.textFields?.first?.text?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !text.isEmpty else { return }
            if !self.tagPool.contains(text) {
                self.tagPool.append(text)
                self.persistTagPool()
            }
            self.selectedTags.insert(text)
            self.rebuildTagChips()
            self.updateSuggestedMemo()
        })
        present(alert, animated: true)
    }

    @objc private func remindTapped(_ sender: UIButton) {
        selectedRemind = sender.tag
        updateRemindUI()

        let cal = Calendar.current
        let now = Date()

        switch selectedRemind {
        case 1:
            // 오늘 저녁 — 18:00 (matching Add screen preset)
            var date = cal.date(bySettingHour: Self.tonightHour, minute: 0, second: 0, of: now) ?? now
            if date <= now { date = cal.date(byAdding: .day, value: 1, to: date) ?? date }
            remindDate = date
            setPickerFromDate(date)
            remindPickerContainer.isHidden = false
        case 2:
            // 내일 아침 — 08:00 (matching Add screen preset)
            let tomorrow = cal.date(byAdding: .day, value: 1, to: now) ?? now
            let date = cal.date(bySettingHour: Self.tomorrowMorningHour, minute: 0, second: 0, of: tomorrow) ?? tomorrow
            remindDate = date
            setPickerFromDate(date)
            remindPickerContainer.isHidden = false
        default:
            // 없음
            remindDate = nil
            remindPickerContainer.isHidden = true
        }

        updateRemindPreview()
        validateRemindTime()
    }

    private func pickerDidChange() {
        let date = pickerToDate()
        remindDate = date
        // When user manually adjusts the wheel, deselect all presets
        selectedRemind = -1
        updateRemindUI()
        updateRemindPreview()
        validateRemindTime()
    }

    private func validateRemindTime() {
        guard let date = remindDate, !(remindPickerContainer?.isHidden ?? true) else {
            // No remind set or picker hidden — valid
            pastTimeWarningLabel?.isHidden = true
            saveBtnRef?.isEnabled = true
            saveBtnRef?.alpha = 1.0
            return
        }
        let isPast = date < Date()
        pastTimeWarningLabel?.isHidden = !isPast
        saveBtnRef?.isEnabled = !isPast
        saveBtnRef?.alpha = isPast ? 0.4 : 1.0
    }

    @objc private func closeTapped() {
        memoField.resignFirstResponder()
        animateOut {
            self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        }
    }

    @objc private func saveTapped() {
        guard !sharedURL.isEmpty else { return }

        let defaults = UserDefaults(suiteName: Self.suiteName)
        var pending = defaults?.array(forKey: "pendingScraps") as? [[String: String]] ?? []

        let fmt = ISO8601DateFormatter()
        let remindAt = remindDate.map { fmt.string(from: $0) } ?? ""
        let memoValue = memoTouched ? (memoField.text ?? "") : suggestedMemo()

        // Encode selected tags as JSON string array
        var tagsJson = ""
        if !selectedTags.isEmpty {
            if let data = try? JSONSerialization.data(withJSONObject: Array(selectedTags)),
               let str = String(data: data, encoding: .utf8) {
                tagsJson = str
            }
        }

        pending.append([
            "url": sharedURL,
            "bucket": selectedBucket,
            "memo": memoValue,
            "remindAt": remindAt,
            "createdAt": fmt.string(from: Date()),
            "tagsJson": tagsJson,
        ])
        defaults?.set(pending, forKey: "pendingScraps")

        // Success feedback
        memoField.resignFirstResponder()
        saveBtnRef?.setTitle("저장됨", for: .normal)
        saveBtnRef?.backgroundColor = .systemGreen
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
            self.cardBottom.constant = 600
            self.view.layoutIfNeeded()
        }, completion: { _ in completion() })
    }
}

// MARK: - UITextFieldDelegate

extension ShareViewController: UITextFieldDelegate {
    func textFieldDidBeginEditing(_ textField: UITextField) {
        if !memoTouched {
            memoTouched = true
            textField.text = ""
            textField.textColor = fg
        }
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        textField.resignFirstResponder()
        return true
    }
}

// MARK: - UIPickerViewDataSource & Delegate

extension ShareViewController: UIPickerViewDataSource, UIPickerViewDelegate {
    func numberOfComponents(in pickerView: UIPickerView) -> Int { 4 }

    func pickerView(_ pickerView: UIPickerView, numberOfRowsInComponent component: Int) -> Int {
        switch component {
        case 0: return dateOptions.count
        case 1: return ampmOptions.count
        case 2: return hourOptions.count
        case 3: return minuteOptions.count
        default: return 0
        }
    }

    func pickerView(_ pickerView: UIPickerView, titleForRow row: Int, forComponent component: Int) -> String? {
        switch component {
        case 0: return dateOptions[row].label
        case 1: return ampmOptions[row]
        case 2: return "\(hourOptions[row])"
        case 3: return String(format: "%02d", minuteOptions[row])
        default: return nil
        }
    }

    func pickerView(_ pickerView: UIPickerView, didSelectRow row: Int, inComponent component: Int) {
        switch component {
        case 0: pickerDateIdx = row
        case 1: pickerAmpmIdx = row
        case 2: pickerHour = hourOptions[row]
        case 3: pickerMinute = minuteOptions[row]
        default: break
        }
        pickerDidChange()
    }

    func pickerView(_ pickerView: UIPickerView, viewForRow row: Int, forComponent component: Int, reusing view: UIView?) -> UIView {
        let label = (view as? UILabel) ?? UILabel()
        label.textAlignment = .center
        label.font = .systemFont(ofSize: 16, weight: .medium)
        label.textColor = fg

        switch component {
        case 0: label.text = dateOptions[row].label
        case 1: label.text = ampmOptions[row]
        case 2: label.text = "\(hourOptions[row])"
        case 3: label.text = String(format: "%02d", minuteOptions[row])
        default: break
        }
        return label
    }
}
