import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/theme.dart';
import '../widgets.dart';
import 'social.dart';

/// Explore = stories on top, then the grid of photos posted to explore.
class ExploreScreen extends StatefulWidget {
  const ExploreScreen({super.key});
  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  List<Map<String, dynamic>> stories = [];
  List<Map<String, dynamic>>? posts;
  Object? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final t = maps(await api.get('/social/trending'));
      final h = Map<String, dynamic>.from(await api.get('/home') as Map);
      if (mounted) setState(() { posts = t; stories = maps(h['stories']); error = null; });
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return SafeArea(
      bottom: false,
      child: error != null && posts == null
          ? ErrorView(error!, _load)
          : posts == null
              ? const Center(child: CircularProgressIndicator(color: AppColors.deep))
              : RefreshIndicator(
                  color: AppColors.deep,
                  onRefresh: _load,
                  child: ListView(padding: const EdgeInsets.fromLTRB(20, 12, 20, kNavSpace), children: [
                    Text('اكسبلور', style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
                    if (stories.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      SizedBox(
                        height: 106,
                        child: ListView(scrollDirection: Axis.horizontal, children: [
                          for (final st in stories)
                            StoryBubble(
                              name: (st['username'] ?? st['name'] ?? '') as String,
                              image: st['cover'] as String?,
                              seen: st['unseen'] != true,
                              onTap: () async {
                                await Navigator.push(context, MaterialPageRoute(builder: (_) => StoryViewerScreen(userId: st['user_id'] as int)));
                                _load();
                              },
                            ),
                        ]),
                      ),
                    ],
                    const SizedBox(height: 14),
                    if (posts!.isEmpty)
                      const EmptyState(Icons.photo_library_outlined, 'ما في صور في الاكسبلور بعد', hint: 'أي صورة تنشر وتفعّل عليها الاكسبلور بتظهر هنا.')
                    else
                      ClipRRect(borderRadius: BorderRadius.circular(22), child: PostGrid(posts!)),
                  ]),
                ),
    );
  }
}
