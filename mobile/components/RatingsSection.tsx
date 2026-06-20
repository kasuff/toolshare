import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PublicRating } from '@toolshare/shared';
import { Colors, Spacing, Radius } from '../constants/theme';
import { ThemedText } from './ThemedText';
import { StarRatingDisplay } from './StarRatingInput';

type Props = {
  title?: string;
  ratings: PublicRating[];
  emptyText?: string;
};

function averageScore(ratings: PublicRating[]) {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((total, rating) => total + rating.score, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

export function RatingsSection({
  title = "Bewertungen",
  ratings,
  emptyText = "Noch keine Bewertungen vorhanden."
}: Props) {
  const avg = averageScore(ratings);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="subtitle">{title}</ThemedText>
        {ratings.length > 0 && (
          <ThemedText type="muted" style={styles.subtitle}>
            {ratings.length} Bewertung{ratings.length === 1 ? "" : "en"}
          </ThemedText>
        )}
      </View>

      {ratings.length === 0 ? (
        <View style={styles.emptyState}>
          <ThemedText type="muted" style={styles.emptyText}>{emptyText}</ThemedText>
        </View>
      ) : (
        <View>
          <View style={styles.summary}>
            <StarRatingDisplay score={Math.round(avg)} size={20} />
            <ThemedText style={styles.summaryText}>
              {avg.toFixed(1).replace(".0", "")} / 5
            </ThemedText>
          </View>
          
          <View style={styles.list}>
            {ratings.map((rating) => (
              <View key={rating.id} style={styles.listItem}>
                <View style={styles.listHead}>
                  <StarRatingDisplay score={rating.score} size={14} />
                  <ThemedText type="muted" style={styles.listMeta}>
                    {rating.fromUserName ?? "Nutzer"} · {new Date(rating.createdIso).toLocaleDateString("de-DE")}
                  </ThemedText>
                </View>
                {rating.comment ? (
                  <ThemedText style={styles.listComment}>{rating.comment}</ThemedText>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  emptyState: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontStyle: 'italic',
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSoft,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  summaryText: {
    marginLeft: Spacing.sm,
    fontWeight: 'bold',
    fontSize: 16,
  },
  list: {
    gap: Spacing.md,
  },
  listItem: {
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingBottom: Spacing.md,
  },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  listMeta: {
    fontSize: 12,
    marginLeft: Spacing.sm,
  },
  listComment: {
    fontSize: 14,
    marginTop: Spacing.xs,
  }
});
