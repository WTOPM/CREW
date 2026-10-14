import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  DetachedRouteHandle,
  RouteReuseStrategy,
} from '@angular/router';

/**
 * Keep main pages mounted when switching nav tabs so Fuel / DG / ETA do not
 * rebuild from scratch each visit. AppData itself is already fully loaded at init.
 */
@Injectable()
export class AppRouteReuseStrategy implements RouteReuseStrategy {
  private readonly stored = new Map<string, DetachedRouteHandle>();

  /** Drop cached pages (e.g. after a full disk reload that needs a fresh view). */
  clear(): void {
    this.stored.clear();
  }

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return this.cacheKey(route) != null;
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const key = this.cacheKey(route);
    if (key == null) return;
    if (handle) this.stored.set(key, handle);
    else this.stored.delete(key);
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const key = this.cacheKey(route);
    return key != null && this.stored.has(key);
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const key = this.cacheKey(route);
    if (key == null) return null;
    return this.stored.get(key) ?? null;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === curr.routeConfig;
  }

  private cacheKey(route: ActivatedRouteSnapshot): string | null {
    const cfg = route.routeConfig;
    if (!cfg?.component) return null;
    const path = cfg.path;
    if (path == null || path === '**') return null;
    // Home uses path: '' — still cacheable.
    return path;
  }
}
