INSERT OR REPLACE INTO candidate_batches (batch_id, status, raw_key, raw_sha256)
VALUES ('mpfa-cf-429-2026-06-30', 'published', 'candidates/mpfa-cf-429-2026-06-30/e5b707db8e224a584706d6e39ae8ada06efd23d7d7709320275a5118b7c48182.json', 'e5b707db8e224a584706d6e39ae8ada06efd23d7d7709320275a5118b7c48182');

INSERT OR IGNORE INTO publication_snapshots (snapshot_id, published_at)
VALUES ('snapshot-mpfa-cf-429-2026-06-30', '2026-08-11T00:00:00Z');

INSERT OR REPLACE INTO fund_class_versions (snapshot_id, fund_class_id, payload)
VALUES ('snapshot-mpfa-cf-429-2026-06-30', 'mpfa-cf-429-class-i', '{"snapshotId":"snapshot-mpfa-cf-429-2026-06-30","fundClass":{"id":"mpfa-cf-429-class-i","trusteeName":"Bank Consortium Trust Company Limited","schemeName":"BCT MPF Scheme Series 800","constituentFundName":"Principal Hong Kong Equity Fund","fundClassName":"Class I","fundType":"Equity Fund","fundCategory":"Hong Kong Equity Fund","dataAsOf":"2026-06-30","fundSizeHkdMillion":3344.42,"annualizedReturn1y":6.09,"cumulativeReturn1y":6.09,"riskClass":6,"fundRiskIndicator":20.73,"latestFer":1.30424,"managementFee":1.03,"oci1yHkd":15,"verificationStatus":"verified"},"provenance":{"sourceUrl":"https://mfp.mpfa.org.hk/mobile/eng/cf_detail.jsp?cf_id=429","dataAsOf":"2026-06-30","retrievedAt":"2026-08-11T00:00:00Z","rawSha256":"e5b707db8e224a584706d6e39ae8ada06efd23d7d7709320275a5118b7c48182","verificationStatus":"verified"}}');

INSERT OR REPLACE INTO current_publication (singleton, snapshot_id)
VALUES (1, 'snapshot-mpfa-cf-429-2026-06-30');
