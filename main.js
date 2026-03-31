import { Actor } from 'apify';
import { CheerioCrawler } from 'crawlee';

await Actor.init();

// ── Config ────────────────────────────────────────────────────────
const KEYWORD  = 'Senior Data Engineer';
const LOCATION = 'United States';
const MAX_JOBS = 50;

// Keywords from Mounish's resume — defined FIRST before any function uses them
const RESUME_KEYWORDS = [
    'AWS', 'ETL', 'Python', 'Airflow', 'Redshift', 'Glue', 'PySpark',
    'Spark', 'Snowflake', 'Databricks', 'Terraform', 'SQL', 'DBT',
    'Lambda', 'S3', 'EMR', 'Kafka', 'Kinesis', 'Data Pipeline',
    'Data Warehouse', 'Data Lake', 'Cloud', 'Azure', 'GCP'
];

// Scoring helpers — defined AFTER RESUME_KEYWORDS
function scoreJob(title, description = '') {
    const text = (title + ' ' + description).toLowerCase();
    return RESUME_KEYWORDS.filter(k => text.includes(k.toLowerCase())).length;
}

function getMatchedKeywords(title, description = '') {
    const text = (title + ' ' + description).toLowerCase();
    return RESUME_KEYWORDS.filter(k => text.includes(k.toLowerCase())).join(', ');
}

// LinkedIn public guest API — f_TPR=r86400 = last 24 hours only
const START_URLS = [0, 25].map(start =>
    `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(KEYWORD)}&location=${encodeURIComponent(LOCATION)}&f_TPR=r86400&start=${start}`
);

console.log(`Searching: "${KEYWORD}" | Location: "${LOCATION}" | Last 24 hours`);

const jobs = [];

const crawler = new CheerioCrawler({
    maxRequestsPerCrawl: 50,
    requestHandlerTimeoutSecs: 90,
    maxConcurrency: 2,

    async requestHandler({ $, request, log }) {
        log.info(`Page loaded: ${request.url}`);

        $('li').each((_, el) => {
            if (jobs.length >= MAX_JOBS) return false;

            const title   = $(el).find('.base-search-card__title, h3').first().text().trim();
            const company = $(el).find('.base-search-card__subtitle, h4').first().text().trim();
            const loc     = $(el).find('.job-search-card__location').first().text().trim();
            const href    = $(el).find('a.base-card__full-link, a').first().attr('href') || '';
            const timeEl  = $(el).find('time');
            const posted  = timeEl.attr('datetime') || timeEl.text().trim() || 'Today';

            if (!title || !company) return;

            jobs.push({
                rank:    jobs.length + 1,
                title,
                company,
                location: loc || 'United States',
                posted,
                url:     href ? href.split('?')[0] : '',
                score:   scoreJob(title),
                matched: getMatchedKeywords(title),
            });
        });

        log.info(`Jobs collected: ${jobs.length}`);
    },

    failedRequestHandler({ request, log }) {
        log.error(`Failed to load: ${request.url}`);
    },
});

await crawler.run(START_URLS);

// Sort best matches first
jobs.sort((a, b) => b.score - a.score);
jobs.forEach((j, i) => { j.rank = i + 1; });

console.log(`Done! Scraped ${jobs.length} jobs.`);
if (jobs[0]) console.log(`Top match: ${jobs[0].title} @ ${jobs[0].company}`);

await Actor.pushData(jobs.slice(0, MAX_JOBS));
await Actor.exit();
