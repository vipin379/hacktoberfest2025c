const usePathUtils = (pathname) => {
  return useMemo(() => {
    const redirects = {
      [`/${pathname.split("/").slice(0, 2).join("/")}/content`]: `/${pathname.split("/").slice(0, 2).join("/")}/content/metaobjects`,
      [`/${pathname.split("/").slice(0, 2).join("/")}/store`]: `/${pathname.split("/").slice(0, 2).join("/")}/store/themes`,
      "/": `/${pathname.split("/").slice(0, 2).join("/")}`,
    };

    const getMenuItemState = (menuItem) => {
      const isHome = menuItem.label === "Home";
      const isSubActive = menuItem.subItems?.some((subItem) => pathname.startsWith(subItem.path));
      const isDirectMatch = pathname === menuItem.path;
      const isDirectChildOfMenuPath = pathname.startsWith(menuItem.path) && !isSubActive;
      const isActive = isHome ? pathname === menuItem.path : isDirectMatch || isDirectChildOfMenuPath;
      const isButtonActive = isHome
        ? pathname === menuItem.path || isSubActive
        : pathname.startsWith(menuItem.path) || isSubActive;
      return { isActive, isButtonActive, isSubActive };
    };
    return { redirects, getMenuItemState };
  }, [pathname]);
};

export default usePathUtils
