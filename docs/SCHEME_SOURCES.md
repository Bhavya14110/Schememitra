# Scheme sources and verification register

Every scheme the eligibility engine knows lives in `services/core/rules/*.yaml`, and each file carries
`source_url`, `verified_on` and `needs_verification`. This page is the human-readable view of the same
data, plus the list of things we could not confirm from an official page.

`needs_verification: true` means at least one number in the file (usually the interest rate, which banks
set) did not come from the official page. The UI then shows the scheme as "illustrative" in admin. The
eligibility conditions themselves come from the source in every file.

Last full pass: **2026-10-11**.

## Schemes in the rule set (18)

| Scheme | Body | Official source | Checked | Needs verification |
|---|---|---|---|---|
| Mukhyamantri Mahila Utkarsh Yojana (Gujarat) | Govt of Gujarat | [myscheme.gov.in/schemes/mmuy](https://www.myscheme.gov.in/schemes/mmuy) | 2026-10-11 | no (see flag 3) |
| PM Vishwakarma (first tranche) | MoMSME | [pmvishwakarma.gov.in](https://pmvishwakarma.gov.in/) | 2026-10-11 | no |
| NSTFDC Term Loan | NSTFDC | [nstfdc.tribal.gov.in/frm_term_loan.aspx](https://nstfdc.tribal.gov.in/frm_term_loan.aspx) | 2026-10-11 | no |
| NSTFDC Adivasi Mahila Sashaktikaran Yojana | NSTFDC | [nstfdc.tribal.gov.in/frm_amsy.aspx](https://nstfdc.tribal.gov.in/frm_amsy.aspx) | 2026-10-11 | yes: rate table garbled on the page |
| Stand-Up India | SIDBI / banks | [standupmitra.in/Home/SUISchemes](https://www.standupmitra.in/Home/SUISchemes) | 2026-10-11 | yes: rate is bank-set |
| PM MUDRA Shishu | MUDRA | [mudra.org.in/Offerings](https://www.mudra.org.in/Offerings) | 2026-10-11 | yes: rate and tenure are bank-set |
| PM MUDRA Kishor | MUDRA | [mudra.org.in/Offerings](https://www.mudra.org.in/Offerings) | 2026-10-11 (loan range) | yes: age band, rate, margin |
| NBCFDC Individual Loan | NBCFDC | [nbcfdc.gov.in](https://nbcfdc.gov.in/nbcfdc/web/individual-loan-scheme) | 2026-09-16 | no |
| NBCFDC Education Loan | NBCFDC | [nbcfdc.gov.in](https://nbcfdc.gov.in/nbcfdc/web/individual-loan-scheme) | 2026-09-16 | no |
| NBCFDC Micro Finance | NBCFDC | [socialjustice.gov.in/schemes/13](https://socialjustice.gov.in/schemes/13) | 2026-09-16 | yes |
| NBCFDC New Swarnima | NBCFDC | [socialjustice.gov.in/schemes/13](https://socialjustice.gov.in/schemes/13) | 2026-09-16 | yes |
| NSFDC Term Loan | NSFDC | [nsfdc.nic.in/scheme](https://nsfdc.nic.in/scheme) | 2026-09-16 | yes |
| NSFDC Micro Credit Finance | NSFDC | [nsfdc.nic.in/scheme](https://nsfdc.nic.in/scheme) | 2026-09-16 | yes |
| NSFDC Mahila Samriddhi | NSFDC | [nsfdc.nic.in/scheme](https://nsfdc.nic.in/scheme) | 2026-09-16 | yes |
| NSFDC Education Loan | NSFDC | [nsfdc.nic.in/scheme](https://nsfdc.nic.in/scheme) | 2026-09-16 | yes |
| NSKFDC Sanitation Enterprise | NSKFDC | [nskfdc.nic.in](https://nskfdc.nic.in/) | 2026-09-16 | yes |
| NSKFDC SHG Group Loan | NSKFDC | [nskfdc.nic.in](https://nskfdc.nic.in/) | 2026-09-16 | yes |
| NDFDC Divyang Self-Employment | NDFDC | [nhfdc.nic.in](https://nhfdc.nic.in/) | 2026-09-16 | yes |

## Flag list: what we could not confirm (kept out of the rules or marked)

1. **PMEGP**: not added. The MSME Ministry page renders empty without optional cookies and the KVIC
   portal (kviconline.gov.in) did not resolve on 2026-10-11. Secondary sources agree on the 2021-26
   limits (Rs 50 lakh manufacturing, Rs 20 lakh service, 15-35% subsidy), but the approved period ended
   in 2025-26 and we found no official word on its extension.
2. **Shri Vajpayee Bankable Yojana (Gujarat)**: not added. myscheme.gov.in lists a Rs 8 lakh loan cap
   (age 18-65, class 4 pass or training/experience, no income test), but a May 2026 IANS report says the
   cap rose to Rs 25 lakh from 2025-26. Needs the Commissioner of Cottage & Rural Industries notification.
3. **Mukhyamantri Mahila Utkarsh Yojana**: added with a note. myscheme describes individual loans; the
   2017 launch reports describe loans to women's groups (JLEGs). Confirm the delivery mode with the
   department (GLPC / Rural Development). Our "up to class 10" education answer stands in for "class 8
   pass"; the marksheet decides.
4. **Gujarat Scheduled Castes Development Corporation (GSCDC) schemes**: not added. Only aggregator
   pages found, and they disagree on income limits (Rs 1.2-1.5 lakh vs Rs 3 lakh vs Rs 6 lakh).
5. **Gujarat Backward Classes, Safai Kamdar, Tribal and Women's development corporations**: not
   researched in depth; they mostly act as state channel partners for the national corporations above.
6. **PM SVANidhi**: not added. The MoHUA page we tried returned "not found".
7. **NSTFDC AMSY rate**: 4% to the beneficiary is our reading of a garbled table.
8. **NSTFDC moratorium**: both NSTFDC pages give a 5-year maximum *including* moratorium but no
   moratorium length, so the app offers none.
9. **PM Vishwakarma trades**: the intake has no 18-trade list; tailoring and handicraft stand in, and
   registration confirms the actual trade. Exclusions (government employees, recent PMEGP/SVANidhi/Mudra
   loans) are checked by the bank, not asked.
10. **Stand-Up India**: greenfield (first venture) and "not in default" are bank checks, not asked.
11. **Vav-Tharad district (GJ-VTH)**: included. The state portal still says 33 districts on 2026-10-11;
    the 34th comes from the state cabinet decision reported by All India Radio.
12. **District coordinates and PIN codes** for the 24 Gujarat districts added on 2026-10-11 are
    approximate HQ town centres from general reference, used only to sort lenders by distance.
13. **The 10 schemes marked `needs_verification`** in the table keep their pre-existing caveats (rates,
    shares and some limits from summaries, not circulars).
