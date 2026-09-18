import { formatCount } from "@/lib/stock";

export type RailItem = {
  href: string;
  label: string;
  icon: string;
  /** Outstanding work on that screen, such as ID cards awaiting review. */
  count?: number;
};

export type RailGroup = {
  title: string;
  items: RailItem[];
};

type RailProps = {
  groups: RailGroup[];
  currentHref: string;
  userName: string;
  roleLabel: string;
};

export function Rail({ groups, currentHref, userName, roleLabel }: RailProps) {
  return (
    <aside className="rail">
      <div className="rail-brand">
        <span className="rail-mark" aria-hidden>
          ⛽
        </span>
        <div>
          <strong>منظومة الوقود</strong>
          <small>صلاح الدين</small>
        </div>
      </div>

      <nav className="rail-nav" aria-label="التنقل الرئيسي">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="rail-section">{group.title}</p>
            {group.items.map((item) => (
              <a
                key={item.href}
                className="rail-item"
                href={item.href}
                aria-current={item.href === currentHref ? "page" : undefined}
              >
                <span className="rail-item-icon" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
                {item.count ? <span className="rail-count">{formatCount(item.count)}</span> : null}
              </a>
            ))}
          </div>
        ))}
      </nav>

      <div className="rail-user">
        <span className="rail-avatar" aria-hidden>
          {userName.slice(0, 1)}
        </span>
        <div>
          <strong>{userName}</strong>
          <small>{roleLabel}</small>
        </div>
      </div>
    </aside>
  );
}
