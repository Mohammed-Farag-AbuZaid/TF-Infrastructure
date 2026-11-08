// 03-sso-auth-hub/flutter-sdk/tf_sso_client.dart
// =============================================================================
// TF Unions — Unified Single Sign-On (SSO) Hydration Helper for Flutter Web
// Designed for drop-in integration into:
//   - TF News (`news.tfunions.org` -> `lib/authentication/authentication_repository.dart`)
//   - TF Connect (`connect.tfunions.org`)
//   - STEM Union / STEM Shop
// =============================================================================

import 'dart:convert';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart' show kIsWeb, debugPrint;
import 'package:http/http.dart' as http;
// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;

class TfUserHint {
  final String uid;
  final String name;
  final String role;

  const TfUserHint({
    required this.uid,
    required this.name,
    required this.role,
  });

  factory TfUserHint.fromJson(Map<String, dynamic> json) {
    return TfUserHint(
      uid: (json['uid'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      role: (json['role'] ?? 'student').toString(),
    );
  }
}

class TfSsoClient {
  TfSsoClient._();

  static const String authHubOrigin = 'https://auth.tfunions.org';

  /// Reads the non-sensitive `tf_user_hint` cookie scoped to `.tfunions.org`
  /// so headers/navbars can render the logged-in user's name immediately.
  static TfUserHint? readUserHintCookie() {
    if (!kIsWeb) return null;
    try {
      final rawCookies = html.document.cookie ?? '';
      for (final part in rawCookies.split(';')) {
        final idx = part.indexOf('=');
        if (idx == -1) continue;
        final key = part.substring(0, idx).trim();
        if (key == 'tf_user_hint') {
          final encodedVal = part.substring(idx + 1).trim();
          if (encodedVal.isEmpty) return null;
          final decodedJson = Uri.decodeComponent(encodedVal);
          final map = jsonDecode(decodedJson) as Map<String, dynamic>;
          return TfUserHint.fromJson(map);
        }
      }
    } catch (e) {
      debugPrint('[TfSsoClient] Failed to parse tf_user_hint cookie: $e');
    }
    return null;
  }

  /// Call this in `main()` or `AuthenticationRepository.screenRedirect()` before
  /// checking `FirebaseAuth.instance.currentUser`.
  ///
  /// If `currentUser` is null on `news.tfunions.org` or `connect.tfunions.org`,
  /// but `.tfunions.org` has an active `tf_user_hint` cookie, this exchanges the
  /// `HttpOnly` `tf_session` cookie for a short-lived Firebase Custom Token and
  /// signs in silently in the background.
  static Future<User?> ensureHydratedFromRootCookie() async {
    final auth = FirebaseAuth.instance;
    if (auth.currentUser != null) {
      return auth.currentUser;
    }
    if (!kIsWeb) return null;

    final hint = readUserHintCookie();
    if (hint == null) return null;

    try {
      // Perform cross-subdomain credentialed fetch using browser HttpRequest
      final req = await html.HttpRequest.request(
        '$authHubOrigin/api/mintCustomToken',
        method: 'GET',
        withCredentials: true,
      );

      if (req.status == 200 && req.responseText != null) {
        final body = jsonDecode(req.responseText!) as Map<String, dynamic>;
        final customToken = body['customToken'] as String?;
        if (customToken != null && customToken.isNotEmpty) {
          final cred = await auth.signInWithCustomToken(customToken);
          return cred.user;
        }
      }
    } catch (e) {
      debugPrint('[TfSsoClient] Silent SSO token exchange failed: $e');
    }
    return null;
  }

  /// Redirects the browser to `https://auth.tfunions.org/?redirect_to=<current_url>`
  static void redirectToCentralLogin({String? returnUrl}) {
    if (!kIsWeb) return;
    final target = returnUrl ?? html.window.location.href;
    final encoded = Uri.encodeComponent(target);
    html.window.location.assign('$authHubOrigin/?redirect_to=$encoded');
  }

  /// Signs out of local Firebase Auth AND clears `.tfunions.org` root session cookies
  static Future<void> signOutEverywhere() async {
    if (kIsWeb) {
      try {
        await html.HttpRequest.request(
          '$authHubOrigin/api/sessionLogout',
          method: 'POST',
          withCredentials: true,
        );
      } catch (e) {
        debugPrint('[TfSsoClient] Failed to clear root session cookies: $e');
      }
    }
    await FirebaseAuth.instance.signOut();
  }
}
