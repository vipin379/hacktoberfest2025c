export const merchant = () => {
  return merchant?.Theme?.map((theme) => ({
        id: theme.id,
        title: theme.title,
        version: theme.version,
        updatedAt: format(
          new Date(theme.updatedAt ?? theme.createdAt),
          'MM/dd/yyyy'
        ),
      })) ||
      []
}
