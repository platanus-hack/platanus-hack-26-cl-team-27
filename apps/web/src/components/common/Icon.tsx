import { cx } from '@team27/ui';
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Bell,
  BellRing,
  BookOpen,
  Building2,
  Calculator,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleDot,
  Clock,
  Coins,
  Ellipsis,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Flag,
  Folder,
  FolderKanban,
  GitCompareArrows,
  Handshake,
  Hash,
  Hourglass,
  Layers,
  ListChecks,
  Loader,
  Lock,
  LogIn,
  type LucideIcon,
  Mail,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Minus,
  Network,
  Pencil,
  Plug,
  Plus,
  QrCode,
  RefreshCw,
  Route,
  Ruler,
  Send,
  ShieldCheck,
  Sparkles,
  Swords,
  Trash2,
  Upload,
  User,
  UserCheck,
  UserX,
  Users,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';

const ICONS = {
  check: Check,
  alert: CircleAlert,
  hourglass: Hourglass,
  minus: Minus,
  dot: CircleDot,
  file: FileText,
  bell: Bell,
  bellRing: BellRing,
  user: User,
  userCheck: UserCheck,
  userX: UserX,
  users: Users,
  upload: Upload,
  arrow: ArrowRight,
  back: ArrowLeft,
  lock: Lock,
  wifiOff: WifiOff,
  seal: ShieldCheck,
  ban: Ban,
  chevron: ChevronRight,
  chevronDown: ChevronDown,
  close: X,
  dots: Ellipsis,
  calendar: CalendarClock,
  clock: Clock,
  coins: Coins,
  folder: Folder,
  project: FolderKanban,
  mail: Mail,
  chat: MessagesSquare,
  whatsapp: MessageCircle,
  slack: Hash,
  book: BookOpen,
  refresh: RefreshCw,
  external: ExternalLink,
  qr: QrCode,
  sparkles: Sparkles,
  diff: GitCompareArrows,
  network: Network,
  conflict: Swords,
  zap: Zap,
  calculator: Calculator,
  send: Send,
  listChecks: ListChecks,
  mapPin: MapPin,
  building: Building2,
  layers: Layers,
  sheet: FileSpreadsheet,
  plug: Plug,
  login: LogIn,
  pencil: Pencil,
  plus: Plus,
  trash: Trash2,
  route: Route,
  ruler: Ruler,
  handshake: Handshake,
  eye: Eye,
  flag: Flag,
  spinner: Loader,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  readonly name: IconName;
  readonly className?: string;
  readonly filled?: boolean;
}

export function Icon({ name, className, filled = false }: IconProps) {
  const Glyph = ICONS[name];
  if (!filled) {
    return (
      <Glyph
        aria-hidden
        strokeWidth={2}
        className={cx('size-4 shrink-0', className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cx(
        'relative inline-grid size-4 shrink-0 place-items-center',
        className,
      )}
    >
      <span className="absolute inset-0 rounded-full bg-current opacity-15" />
      <Glyph strokeWidth={2.4} className="relative size-[70%]" />
    </span>
  );
}
