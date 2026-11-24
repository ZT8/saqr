// Icons: Phosphor, one family everywhere. Name map keeps call sites stable.
// weight: regular by default, "fill" when a `fill` colour is passed (liked, rated, active tab).
import {
  House, Receipt, Compass, UsersThree, DotsThree, MagnifyingGlass, Bell, Gift, MapTrifold, MapPin, Heart, ChatCircle,
  ShareNetwork, BookmarkSimple, CaretRight, X, Plus, Minus, Check, Car, Clock, CookingPot, Star, Crown, Camera, Image,
  Lightning, CameraRotate, TextAa, Smiley, ArrowLeft, User, SignOut, Phone, Path, PencilSimple, Trash, Flag, Storefront,
  ChartBar, List, GearSix, Users, Wallet, Coffee, Hamburger, Bread, OrangeSlice, Cake, Basket, Pill, ForkKnife,
  ArrowUpRight, Sparkle, NavigationArrow, Timer, SealCheck, ShieldCheck, Medal, Warning, CheckCircle, Copy,
  SpeakerHigh, SpeakerSlash, Stamp, TrendUp, CreditCard, QrCode, Fire, Info, PaperPlaneTilt,
} from '@phosphor-icons/react';

const MAP = {
  home: House, orders: Receipt, explore: Compass, social: UsersThree, more: DotsThree, search: MagnifyingGlass,
  bell: Bell, gift: Gift, map: MapTrifold, pin: MapPin, heart: Heart, comment: ChatCircle, share: ShareNetwork,
  bookmark: BookmarkSimple, back: CaretRight, close: X, plus: Plus, minus: Minus, check: Check, car: Car, clock: Clock,
  prep: CookingPot, star: Star, crown: Crown, camera: Camera, image: Image, flash: Lightning, flip: CameraRotate,
  text: TextAa, sticker: Smiley, send: ArrowLeft, user: User, logout: SignOut, phone: Phone, route: Path,
  edit: PencilSimple, trash: Trash, flag: Flag, store: Storefront, chart: ChartBar, menu: List, settings: GearSix,
  users: Users, wallet: Wallet, coffee: Coffee, burger: Hamburger, bakery: Bread, juice: OrangeSlice, dessert: Cake,
  grocery: Basket, pharmacy: Pill, restaurant: ForkKnife,
  // new
  arrow: ArrowUpRight, spark: Sparkle, nav: NavigationArrow, timer: Timer, verified: SealCheck, shield: ShieldCheck,
  medal: Medal, warn: Warning, ok: CheckCircle, copy: Copy, sound: SpeakerHigh, mute: SpeakerSlash, stamp: Stamp,
  trend: TrendUp, card: CreditCard, qr: QrCode, fire: Fire, info: Info, plane: PaperPlaneTilt,
};
const MIRROR = new Set(['logout']);

export default function Icon({ name, size = 22, stroke, fill = 'none', color = 'currentColor', className, style, label, weight }) {
  const C = MAP[name] || Storefront;
  const w = weight || (fill && fill !== 'none' ? 'fill' : stroke && stroke <= 1.6 ? 'light' : 'regular');
  return (
    <C size={size} weight={w} color={fill && fill !== 'none' && fill !== 'currentColor' ? fill : color} mirrored={MIRROR.has(name)}
      className={className} style={style} aria-hidden={label ? undefined : true} aria-label={label} role={label ? 'img' : undefined} />
  );
}

// Around mark: a ring (the area around you) with a dot orbiting it (you, arriving).
export function Logo({ size = 32, ink = 'currentColor', dot = 'var(--accent)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="10" fill="none" stroke={ink} strokeWidth="4.5" />
      <circle cx="25.2" cy="8.2" r="4.4" fill={dot} stroke={ink} strokeWidth="1.8" />
    </svg>
  );
}
export function Wordmark({ size = 26, ink = 'currentColor' }) {
  return (
    <span className="wordmark" style={{ fontSize: size, color: ink }}>
      <Logo size={size * 1.1} ink={ink} />
      <span>around</span>
    </span>
  );
}
