import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../core/api.dart';
import '../core/cart.dart';
import '../core/format.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../widgets.dart';
import 'checkout.dart';
import 'more.dart';

/// Fills the cart from a post's order and opens checkout.
Future<void> reorderFromPost(BuildContext context, Map post) async {
  final m = post['merchant'] as Map?;
  if (m == null) return;
  try {
    final s = Map<String, dynamic>.from(await api.get('/stores/${m['id']}') as Map);
    final all = maps(s['menu']).expand((c) => maps(c['items'])).toList();
    final branches = maps(s['branches']);
    cart.start(s['id'] as int, branches.first['id'] as int, s['name'] as String);
    cart.lines.clear();
    var added = 0;
    for (final i in (post['items'] as List? ?? const [])) {
      final it = all.where((x) => x['id'] == i['item_id'] && x['is_available'] == true).toList();
      if (it.isEmpty) continue;
      cart.addMany(it.first['id'] as int, it.first['name'] as String, it.first['price'] as int, (i['qty'] as num).toInt());
      added++;
    }
    if (added == 0) throw 'المنتجات غير متوفرة الحين';
    cart.sourcePostId = post['id'] as int?;
    if (context.mounted) Navigator.push(context, MaterialPageRoute(builder: (_) => const CheckoutScreen()));
  } catch (e) {
    if (context.mounted) toast(context, e);
  }
}

// ---------------------------------------------------------------- stories bar

class StoryBubble extends StatelessWidget {
  final String name;
  final String? image;
  final Map? user;
  final bool seen;
  final bool plus;
  final VoidCallback onTap;
  const StoryBubble({super.key, required this.name, required this.onTap, this.image, this.user, this.seen = false, this.plus = false});

  @override
  Widget build(BuildContext context) {
    final ring = plus ? AppColors.deep : (seen ? AppColors.line : AppColors.accent);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        width: 78,
        child: Column(children: [
          Container(
            width: 70,
            height: 70,
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: ring, width: 3)),
            child: ClipOval(
              child: Stack(fit: StackFit.expand, children: [
                if (image != null && image!.isNotEmpty) NetImage(image) else UserAvatar(user, size: 64),
                if (plus) Container(color: image != null ? AppColors.deep.withValues(alpha: .5) : Colors.transparent, child: Icon(Icons.add_a_photo_rounded, color: image != null ? Colors.white : AppColors.deep)),
              ]),
            ),
          ),
          const SizedBox(height: 6),
          Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }
}

// ----------------------------------------------------------------- post card

class PostCard extends StatelessWidget {
  final Map<String, dynamic> post;
  final ValueChanged<Map<String, dynamic>> onChange;
  final bool openOnTap;
  const PostCard({super.key, required this.post, required this.onChange, this.openOnTap = true});

  Future<void> _like(BuildContext context) async {
    try {
      final r = await api.post('/social/posts/${post['id']}/like') as Map;
      onChange({...post, 'liked': r['liked'], 'likes': r['likes']});
    } catch (e) {
      if (context.mounted) toast(context, e);
    }
  }

  Future<void> _save(BuildContext context) async {
    try {
      final r = await api.post('/social/posts/${post['id']}/save') as Map;
      onChange({...post, 'saved': r['saved']});
    } catch (e) {
      if (context.mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final user = post['user'] as Map? ?? {};
    final merchant = post['merchant'] as Map?;
    final items = (post['items'] as List? ?? const []).cast<Map>();
    final liked = post['liked'] == true;
    final mine = post['mine'] == true;
    void openPost() => Navigator.push(context, MaterialPageRoute(builder: (_) => PostScreen(id: post['id'] as int)));
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      color: Colors.white,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        InkWell(
          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => UserProfileScreen(id: user['id'] as int))),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Row(children: [
              UserAvatar(user, size: 40),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${user['username'] ?? user['name'] ?? ''}', style: t.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                  Text(ago(post['created_at'] as String?), style: t.labelSmall?.copyWith(color: AppColors.muted)),
                ]),
              ),
            ]),
          ),
        ),
        GestureDetector(
          onTap: openOnTap ? openPost : null,
          child: AspectRatio(aspectRatio: 4 / 5, child: SizedBox(width: double.infinity, child: NetImage(post['image'] as String?))),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(8, 4, 8, 0),
          child: Row(children: [
            TextButton.icon(
              onPressed: () => _like(context),
              icon: Icon(liked ? Icons.favorite_rounded : Icons.favorite_border_rounded, color: liked ? const Color(0xFFD93A5B) : AppColors.ink),
              label: Text('${post['likes'] ?? 0}', style: const TextStyle(color: AppColors.ink)),
            ),
            TextButton.icon(
              onPressed: openPost,
              icon: const Icon(Icons.mode_comment_outlined, color: AppColors.ink),
              label: Text('${post['comments'] ?? 0}', style: const TextStyle(color: AppColors.ink)),
            ),
            const Spacer(),
            IconButton(
              onPressed: () => _save(context),
              icon: Icon(post['saved'] == true ? Icons.bookmark_rounded : Icons.bookmark_border_rounded, color: AppColors.ink),
            ),
          ]),
        ),
        if ((post['caption'] as String? ?? '').isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Text.rich(TextSpan(children: [
              TextSpan(text: '${user['username'] ?? user['name'] ?? ''} ', style: const TextStyle(fontWeight: FontWeight.w700)),
              TextSpan(text: post['caption'] as String),
            ])),
          ),
        if (merchant != null)
          Container(
            margin: const EdgeInsets.fromLTRB(12, 0, 12, 14),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: AppColors.ground, borderRadius: BorderRadius.circular(16)),
            child: Row(children: [
              StoreAvatar(Map<String, dynamic>.from(merchant), size: 40),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${merchant['name']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: t.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                  Text(items.map((i) => '${i['qty']} × ${i['name']}').join('، '), maxLines: 1, overflow: TextOverflow.ellipsis, style: t.labelSmall?.copyWith(color: AppColors.muted)),
                ]),
              ),
              if (!mine && items.isNotEmpty)
                FilledButton(
                  onPressed: () => reorderFromPost(context, post),
                  style: FilledButton.styleFrom(minimumSize: const Size(0, 40), padding: const EdgeInsets.symmetric(horizontal: 14)),
                  child: const Text('اطلب نفسه'),
                ),
            ]),
          )
        else
          const SizedBox(height: 6),
      ]),
    );
  }
}

// ------------------------------------------------------------ social screen

class SocialScreen extends StatefulWidget {
  const SocialScreen({super.key});
  @override
  State<SocialScreen> createState() => _SocialScreenState();
}

class _SocialScreenState extends State<SocialScreen> {
  String tab = 'foryou';
  List<Map<String, dynamic>>? posts;
  List<Map<String, dynamic>> stories = [];
  int? next;
  Object? error;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { error = null; if (posts == null) busy = true; });
    try {
      final r = Map<String, dynamic>.from(await api.get('/social/feed', query: {'tab': tab}) as Map);
      final home = Map<String, dynamic>.from(await api.get('/home') as Map);
      if (!mounted) return;
      setState(() { posts = maps(r['posts']); next = r['next'] as int?; stories = maps(home['stories']); busy = false; });
    } catch (e) {
      if (mounted) setState(() { error = e; busy = false; });
    }
  }

  Future<void> _more() async {
    if (next == null) return;
    try {
      final r = Map<String, dynamic>.from(await api.get('/social/feed', query: {'tab': tab, 'offset': '$next'}) as Map);
      if (!mounted) return;
      setState(() { posts = [...?posts, ...maps(r['posts'])]; next = r['next'] as int?; });
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  void _setTab(String t) {
    if (t == tab) return;
    setState(() { tab = t; posts = null; });
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final me = session.user ?? {};
    return SafeArea(
      bottom: false,
      child: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 12, 0),
          child: Row(children: [
            Expanded(child: Text('Around Social', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700))),
            CircleBtn(Icons.notifications_none_rounded, onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationsScreen()))),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 10),
          child: Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(color: AppColors.chip, borderRadius: BorderRadius.circular(99)),
            child: Row(children: [
              for (final t in const [['following', 'أتابعهم'], ['foryou', 'لك']])
                Expanded(
                  child: PressScale(
                    onTap: () => _setTab(t[0]),
                    scale: .98,
                    child: AnimatedContainer(
                      duration: kMed,
                      curve: kEase,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: tab == t[0] ? Colors.white : Colors.transparent, borderRadius: BorderRadius.circular(99), boxShadow: tab == t[0] ? [BoxShadow(color: AppColors.deep.withValues(alpha: .06), blurRadius: 10, offset: const Offset(0, 3))] : null),
                      child: Text(t[1], style: TextStyle(fontWeight: FontWeight.w700, color: tab == t[0] ? AppColors.deep : AppColors.muted)),
                    ),
                  ),
                ),
            ]),
          ),
        ),
        Expanded(
          child: error != null && posts == null
              ? ErrorView(error!, _load)
              : posts == null
                  ? const Center(child: CircularProgressIndicator(color: AppColors.deep))
                  : RefreshIndicator(
                      color: AppColors.deep,
                      onRefresh: _load,
                      child: ListView(padding: const EdgeInsets.only(bottom: kNavSpace), children: [
                        Container(
                          color: Colors.transparent,
                          height: 112,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          child: ListView(scrollDirection: Axis.horizontal, children: [
                            StoryBubble(
                              name: 'منشور جديد',
                              plus: true,
                              user: me,
                              image: me['avatar'] as String?,
                              onTap: () async {
                                await Navigator.push(context, MaterialPageRoute(builder: (_) => const PostComposerScreen()));
                                _load();
                              },
                            ),
                            for (final s in stories)
                              StoryBubble(
                                name: (s['username'] ?? s['name'] ?? '') as String,
                                image: s['cover'] as String?,
                                seen: s['unseen'] != true,
                                onTap: () async {
                                  await Navigator.push(context, MaterialPageRoute(builder: (_) => StoryViewerScreen(userId: s['user_id'] as int)));
                                  _load();
                                },
                              ),
                          ]),
                        ),
                        const SizedBox(height: 10),
                        if (posts!.isEmpty)
                          EmptyState(Icons.camera_alt_outlined, tab == 'following' ? 'تابع ناس عشان تشوف طلباتهم' : 'ما فيه منشورات للحين', hint: 'صوّر طلبك وشاركه')
                        else
                          for (var i = 0; i < posts!.length; i++)
                            PostCard(post: posts![i], onChange: (np) => setState(() => posts![i] = np)),
                        if (next != null) Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 20), child: OutlinedButton(onPressed: _more, child: const Text('عرض المزيد'))),
                      ]),
                    ),
        ),
      ]),
    );
  }
}

// -------------------------------------------------------------- single post

class PostScreen extends StatefulWidget {
  final int id;
  const PostScreen({super.key, required this.id});
  @override
  State<PostScreen> createState() => _PostScreenState();
}

class _PostScreenState extends State<PostScreen> {
  Map<String, dynamic>? post;
  List<Map<String, dynamic>> comments = [];
  Object? error;
  final body = TextEditingController();
  bool sending = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final p = Map<String, dynamic>.from(await api.get('/social/posts/${widget.id}') as Map);
      final c = maps(await api.get('/social/posts/${widget.id}/comments'));
      if (mounted) setState(() { post = p; comments = c; error = null; });
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  Future<void> _send() async {
    final text = body.text.trim();
    if (text.isEmpty || sending) return;
    setState(() => sending = true);
    try {
      final c = Map<String, dynamic>.from(await api.post('/social/posts/${widget.id}/comments', {'body': text}) as Map);
      c['created_at'] = DateTime.now().toUtc().toIso8601String();
      body.clear();
      if (mounted) setState(() { comments = [...comments, c]; post = {...post!, 'comments': (post!['comments'] as int) + 1}; });
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Future<void> _report() async {
    try {
      await api.post('/social/posts/${widget.id}/report', {'reason': 'محتوى غير لائق'});
      if (mounted) toast(context, 'شكراً، بنراجع البلاغ');
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('تحذف المنشور؟'),
        actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('لا')), TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('احذف'))],
      ),
    );
    if (ok != true) return;
    try {
      await api.delete('/social/posts/${widget.id}');
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = post;
    return Scaffold(
      appBar: AppBar(
        title: const Text('منشور'),
        actions: [
          if (p != null)
            p['mine'] == true
                ? IconButton(onPressed: _delete, icon: const Icon(Icons.delete_outline_rounded))
                : IconButton(onPressed: _report, icon: const Icon(Icons.flag_outlined)),
        ],
      ),
      body: p == null
          ? (error != null ? ErrorView(error!, _load) : const Center(child: CircularProgressIndicator(color: AppColors.deep)))
          : Column(children: [
              Expanded(
                child: ListView(children: [
                  PostCard(post: p, onChange: (np) => setState(() => post = np), openOnTap: false),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('التعليقات', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 10),
                      if (comments.isEmpty) Text('كن أول من يعلّق', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.muted)),
                      for (final c in comments)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            InkWell(
                              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => UserProfileScreen(id: c['user_id'] as int))),
                              child: UserAvatar(c, size: 34),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text.rich(TextSpan(children: [
                                  TextSpan(text: '${c['username'] ?? c['name'] ?? ''} ', style: const TextStyle(fontWeight: FontWeight.w700)),
                                  TextSpan(text: '${c['body']}'),
                                ])),
                                Text(ago(c['created_at'] as String?), style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppColors.muted)),
                              ]),
                            ),
                          ]),
                        ),
                      const SizedBox(height: 20),
                    ]),
                  ),
                ]),
              ),
              SafeArea(
                top: false,
                child: Padding(
                  padding: EdgeInsets.fromLTRB(16, 8, 16, 8 + MediaQuery.of(context).viewInsets.bottom),
                  child: Row(children: [
                    Expanded(child: TextField(controller: body, maxLength: 300, decoration: const InputDecoration(hintText: 'اكتب تعليق…', counterText: ''), onSubmitted: (_) => _send())),
                    const SizedBox(width: 8),
                    IconButton.filled(
                      onPressed: sending ? null : _send,
                      style: IconButton.styleFrom(backgroundColor: AppColors.deep, foregroundColor: Colors.white),
                      icon: const Icon(Icons.send_rounded),
                    ),
                  ]),
                ),
              ),
            ]),
    );
  }
}

// --------------------------------------------------------------- user profile

class UserProfileScreen extends StatefulWidget {
  final int id;
  const UserProfileScreen({super.key, required this.id});
  @override
  State<UserProfileScreen> createState() => _UserProfileScreenState();
}

class _UserProfileScreenState extends State<UserProfileScreen> {
  Map<String, dynamic>? u;
  Object? error;
  String tab = 'posts';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = Map<String, dynamic>.from(await api.get('/social/users/${widget.id}') as Map);
      if (mounted) setState(() { u = r; error = null; });
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  Future<void> _follow() async {
    try {
      final r = await api.post('/social/users/${widget.id}/follow') as Map;
      final following = r['following'] == true;
      setState(() => u = {...u!, 'is_following': following, 'followers': (u!['followers'] as int) + (following ? 1 : -1)});
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final x = u;
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(
        title: Text(x == null ? '' : (x['username'] != null ? '@${x['username']}' : '${x['name']}')),
        actions: [
          if (x != null && x['mine'] == true)
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              onPressed: () async {
                await Navigator.push(context, MaterialPageRoute(builder: (_) => const EditProfileScreen()));
                _load();
              },
            ),
        ],
      ),
      body: x == null
          ? (error != null ? ErrorView(error!, _load) : const Center(child: CircularProgressIndicator(color: AppColors.deep)))
          : Builder(builder: (context) {
              final list = maps(tab == 'saved' ? x['saved'] : x['posts']);
              Widget stat(String n, String l) => Column(children: [Text(n, style: t.titleMedium?.copyWith(fontWeight: FontWeight.w700)), Text(l, style: t.labelMedium?.copyWith(color: AppColors.muted))]);
              return RefreshIndicator(
                color: AppColors.deep,
                onRefresh: _load,
                child: ListView(children: [
                  const SizedBox(height: 8),
                  Center(child: UserAvatar(x, size: 92)),
                  const SizedBox(height: 10),
                  Center(child: Text('${x['name']}', style: t.titleLarge?.copyWith(fontWeight: FontWeight.w700))),
                  const SizedBox(height: 14),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    stat('${(x['posts'] as List).length}', 'منشور'),
                    const SizedBox(width: 32),
                    stat('${x['followers']}', 'متابِع'),
                    const SizedBox(width: 32),
                    stat('${x['following']}', 'يتابع'),
                  ]),
                  const SizedBox(height: 14),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 60),
                    child: x['mine'] == true
                        ? FilledButton.icon(
                            onPressed: () async {
                              await Navigator.push(context, MaterialPageRoute(builder: (_) => const PostComposerScreen()));
                              _load();
                            },
                            icon: const Icon(Icons.add_a_photo_rounded),
                            label: const Text('منشور جديد'),
                          )
                        : (x['is_following'] == true
                            ? OutlinedButton(onPressed: _follow, child: const Text('تتابعه'))
                            : FilledButton(onPressed: _follow, child: const Text('تابِع'))),
                  ),
                  const SizedBox(height: 14),
                  if (x['mine'] == true)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: SegmentedButton<String>(
                        segments: const [ButtonSegment(value: 'posts', label: Text('منشوراتي')), ButtonSegment(value: 'saved', label: Text('المحفوظة'))],
                        selected: {tab},
                        onSelectionChanged: (s) => setState(() => tab = s.first),
                        showSelectedIcon: false,
                      ),
                    ),
                  const SizedBox(height: 10),
                  if (list.isEmpty) EmptyState(Icons.camera_alt_outlined, tab == 'saved' ? 'ما حفظت شي للحين' : 'ما فيه منشورات') else PostGrid(list),
                ]),
              );
            }),
    );
  }
}

class PostGrid extends StatelessWidget {
  final List<Map<String, dynamic>> posts;
  const PostGrid(this.posts, {super.key});
  @override
  Widget build(BuildContext context) => GridView.count(
        crossAxisCount: 3,
        mainAxisSpacing: 2,
        crossAxisSpacing: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        childAspectRatio: 4 / 5,
        children: [
          for (final p in posts)
            GestureDetector(
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => PostScreen(id: p['id'] as int))),
              child: NetImage(p['image'] as String?),
            ),
        ],
      );
}

// ------------------------------------------------------------- story viewer

class StoryViewerScreen extends StatefulWidget {
  final int? userId;
  final int? storeId;
  const StoryViewerScreen({super.key, this.userId, this.storeId});
  @override
  State<StoryViewerScreen> createState() => _StoryViewerScreenState();
}

class _StoryViewerScreenState extends State<StoryViewerScreen> {
  static const _duration = Duration(seconds: 5);
  List<Map<String, dynamic>>? stories;
  int i = 0;
  double progress = 0;
  bool paused = false;
  Timer? timer;
  int elapsedMs = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = widget.storeId != null
          ? maps((await api.get('/stores/${widget.storeId}') as Map)['stories'])
          : maps(await api.get('/social/stories/${widget.userId}'));
      if (list.isEmpty) {
        if (mounted) Navigator.pop(context);
        return;
      }
      if (!mounted) return;
      setState(() => stories = list);
      _startStory();
    } catch (e) {
      if (mounted) {
        toast(context, e);
        Navigator.pop(context);
      }
    }
  }

  void _startStory() {
    timer?.cancel();
    elapsedMs = 0;
    progress = 0;
    final s = stories![i];
    api.post('/social/posts/${s['id']}/view').catchError((_) {});
    timer = Timer.periodic(const Duration(milliseconds: 50), (_) {
      if (paused || !mounted) return;
      elapsedMs += 50;
      final p = elapsedMs / _duration.inMilliseconds;
      if (p >= 1) {
        _go(1);
      } else {
        setState(() => progress = p);
      }
    });
  }

  void _go(int d) {
    final n = i + d;
    if (n < 0) {
      _startStory();
      return;
    }
    if (n >= stories!.length) {
      timer?.cancel();
      Navigator.pop(context);
      return;
    }
    setState(() => i = n);
    _startStory();
  }

  Future<void> _like() async {
    final s = stories![i];
    try {
      final r = await api.post('/social/posts/${s['id']}/like') as Map;
      setState(() => stories![i] = {...s, 'liked': r['liked'], 'likes': r['likes']});
    } catch (e) {
      if (mounted) toast(context, e);
    }
  }

  Future<void> _report() async {
    final s = stories![i];
    paused = true;
    try {
      await api.post('/social/posts/${s['id']}/report', {'reason': 'محتوى غير لائق'});
      if (mounted) toast(context, 'شكراً، بنراجع البلاغ');
    } catch (e) {
      if (mounted) toast(context, e);
    }
    paused = false;
  }

  @override
  Widget build(BuildContext context) {
    final list = stories;
    if (list == null) return const Scaffold(backgroundColor: Colors.black, body: Center(child: CircularProgressIndicator(color: Colors.white)));
    final s = list[i];
    final user = s['user'] as Map? ?? {};
    final merchant = s['merchant'] as Map?;
    final items = (s['items'] as List? ?? const []).cast<Map>();
    final liked = s['liked'] == true;
    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onLongPressStart: (_) => paused = true,
        onLongPressEnd: (_) => paused = false,
        onTapUp: (d) {
          // RTL: right half = previous, left half = next.
          final w = MediaQuery.of(context).size.width;
          _go(d.localPosition.dx > w / 2 ? -1 : 1);
        },
        child: Stack(fit: StackFit.expand, children: [
          NetImage(s['image'] as String?, fit: BoxFit.contain),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.black.withValues(alpha: .55), Colors.transparent, Colors.transparent, Colors.black.withValues(alpha: .7)], stops: const [0, .22, .6, 1]),
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 16),
              child: Column(children: [
                Row(children: [
                  for (var k = 0; k < list.length; k++)
                    Expanded(
                      child: Container(
                        height: 3,
                        margin: const EdgeInsets.symmetric(horizontal: 2),
                        decoration: BoxDecoration(color: Colors.white30, borderRadius: BorderRadius.circular(2)),
                        child: FractionallySizedBox(alignment: AlignmentDirectional.centerStart, widthFactor: k < i ? 1 : (k == i ? progress : 0), child: Container(decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(2)))),
                      ),
                    ),
                ]),
                const SizedBox(height: 12),
                Row(children: [
                  UserAvatar(user, size: 36),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${user['username'] ?? user['name'] ?? ''}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                      Text(ago(s['created_at'] as String?), style: const TextStyle(color: Colors.white70, fontSize: 12)),
                    ]),
                  ),
                  if (s['mine'] != true) IconButton(onPressed: _report, icon: const Icon(Icons.flag_outlined, color: Colors.white)),
                  IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close_rounded, color: Colors.white)),
                ]),
                const Spacer(),
                if ((s['caption'] as String? ?? '').isNotEmpty) Align(alignment: AlignmentDirectional.centerStart, child: Text('${s['caption']}', style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w600))),
                const SizedBox(height: 10),
                if (merchant != null)
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: .95), borderRadius: BorderRadius.circular(18)),
                    child: Column(children: [
                      Row(children: [
                        StoreAvatar(Map<String, dynamic>.from(merchant), size: 40),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('${merchant['name']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
                            Text(items.map((x) => '${x['qty']} × ${x['name']}').join('، '), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                          ]),
                        ),
                      ]),
                      if (s['mine'] != true && items.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        FilledButton(
                          onPressed: () {
                            timer?.cancel();
                            reorderFromPost(context, s);
                          },
                          child: const Text('اطلب نفس الطلب'),
                        ),
                      ],
                    ]),
                  ),
                const SizedBox(height: 8),
                Row(children: [
                  TextButton.icon(
                    onPressed: _like,
                    icon: Icon(liked ? Icons.favorite_rounded : Icons.favorite_border_rounded, color: liked ? const Color(0xFFFF4D6A) : Colors.white, size: 28),
                    label: Text('${s['likes'] ?? 0}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                  ),
                ]),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

// ------------------------------------------------------------ post composer

class PostComposerScreen extends StatefulWidget {
  const PostComposerScreen({super.key});
  @override
  State<PostComposerScreen> createState() => _PostComposerScreenState();
}

class _PostComposerScreenState extends State<PostComposerScreen> {
  final picker = ImagePicker();
  XFile? file;
  final caption = TextEditingController();
  bool inExplore = true;
  bool attach = true;
  bool busy = false;
  int? orderId;
  List<Map<String, dynamic>> delivered = [];

  @override
  void initState() {
    super.initState();
    _orders();
  }

  Future<void> _orders() async {
    try {
      final all = maps(await api.get('/orders'));
      final d = all.where((o) => o['status'] == 'delivered').take(10).toList();
      if (mounted) setState(() { delivered = d; orderId = d.isNotEmpty ? d.first['id'] as int : null; });
    } catch (_) {}
  }

  Future<void> _pick(ImageSource src) async {
    try {
      final f = await picker.pickImage(source: src, maxWidth: 1600, imageQuality: 85);
      if (f != null && mounted) setState(() => file = f);
    } catch (e) {
      if (mounted) toast(context, 'ما قدرنا نفتح الكاميرا أو الألبوم. تأكد من الصلاحيات في الإعدادات');
    }
  }

  Future<void> _publish() async {
    if (file == null || busy) return;
    setState(() => busy = true);
    try {
      await api.upload('/social/posts', file!.path, fields: {
        'caption': caption.text.trim(),
        'in_explore': inExplore ? '1' : '0',
        'attach_order': attach ? '1' : '0',
        if (orderId != null) 'order_id': '$orderId',
      });
      if (!mounted) return;
      toast(context, 'نشرنا ستوريك');
      Navigator.pop(context);
    } catch (e) {
      if (mounted) toast(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  String _orderLabel(Map<String, dynamic> o) => '${(o['merchant'] as Map?)?['name'] ?? ''} #${o['id']}';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('منشور جديد')),
      body: file == null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.camera_alt_rounded, size: 56, color: AppColors.deep),
                  const SizedBox(height: 12),
                  Text('صوّر طلبك', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 24),
                  FilledButton.icon(onPressed: () => _pick(ImageSource.camera), icon: const Icon(Icons.camera_alt_rounded), label: const Text('افتح الكاميرا')),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(onPressed: () => _pick(ImageSource.gallery), icon: const Icon(Icons.photo_library_outlined), label: const Text('اختر من الألبوم')),
                ]),
              ),
            )
          : ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 24), children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(22),
                child: AspectRatio(aspectRatio: 4 / 5, child: Image.file(File(file!.path), fit: BoxFit.cover)),
              ),
              const SizedBox(height: 6),
              Row(children: [
                TextButton.icon(onPressed: () => _pick(ImageSource.camera), icon: const Icon(Icons.camera_alt_outlined), label: const Text('صوّر من جديد')),
                TextButton.icon(onPressed: () => _pick(ImageSource.gallery), icon: const Icon(Icons.photo_library_outlined), label: const Text('الألبوم')),
              ]),
              TextField(controller: caption, maxLength: 300, decoration: const InputDecoration(hintText: 'اكتب شي عن طلبك…')),
              const SizedBox(height: 8),
              if (delivered.isNotEmpty) ...[
                Text('من أي طلب؟', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                SizedBox(
                  height: 44,
                  child: ListView(scrollDirection: Axis.horizontal, children: [
                    for (final o in delivered)
                      Padding(
                        padding: const EdgeInsetsDirectional.only(end: 8),
                        child: ChoiceChip(
                          label: Text(_orderLabel(o)),
                          selected: orderId == o['id'],
                          onSelected: (_) => setState(() => orderId = o['id'] as int),
                          showCheckmark: false,
                          selectedColor: AppColors.accentSoft,
                          backgroundColor: AppColors.chip,
                          shape: const StadiumBorder(),
                          side: BorderSide.none,
                        ),
                      ),
                  ]),
                ),
                SwitchListTile(contentPadding: EdgeInsets.zero, value: attach, onChanged: (v) => setState(() => attach = v), title: const Text('أظهر تفاصيل الطلب'), activeColor: AppColors.deep),
              ],
              SwitchListTile(contentPadding: EdgeInsets.zero, value: inExplore, onChanged: (v) => setState(() => inExplore = v), title: const Text('انشر في اكسبلور'), activeColor: AppColors.deep),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: busy ? null : _publish,
                child: busy ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.accentInk)) : const Text('نشر'),
              ),
            ]),
    );
  }
}
