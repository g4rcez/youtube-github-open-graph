import axios from "axios";
import express from "express";
import Fs from "fs/promises";
import { HTMLElement, parse as htmlParse } from "node-html-parser";
import path from "path";
import puppeteer from "puppeteer";
import { Repository } from "./types";

const server = express();

const TEMPLATE_PATH = path.resolve(path.join(process.cwd(), "index.html"));

const setInnerHtml = (html: HTMLElement, selector: string, content: string) => {
  html.querySelector(selector).innerHTML = content;
};

const generateImageFromTemplate = async (repo: Repository) => {
  const template = await Fs.readFile(TEMPLATE_PATH, "utf-8");
  const html = htmlParse(template);
  setInnerHtml(html, "#owner", `${repo.owner.login}/`);
  setInnerHtml(html, "#repo", repo.name);

  setInnerHtml(
    html,
    "#description",
    repo.description ?? "<span style='opacity:0.5'>No description</span>"
  );

  const footerItems = Array.from(
    html.querySelectorAll("#footer > .footer-item")
  );

  footerItems.forEach((item) => {
    const dataInfo = item.getAttribute("data-info");
    if (dataInfo === undefined) return;
    const repoInfo = repo[dataInfo as keyof Repository];
    setInnerHtml(item, "h3", repoInfo as string);
  });

  const imgPlaceholder = html.querySelector("#img-placeholder");
  imgPlaceholder.setAttribute(
    "style",
    `background-image: url(${repo.owner.avatar_url})`
  );

  return html.toString();
};

const getRepoInfo = async (owner: string, repo: string) => {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const response = await axios.get<Repository>(url);
  return response.data;
};

server.get("/:owner/:repo", async (req, res) => {
  const repo = await getRepoInfo(req.params.owner, req.params.repo);
  const htmlContent = await generateImageFromTemplate(repo);

  const browser = await puppeteer.launch({
    defaultViewport: {
      height: 325,
      width: 900,
    },
  });

  const page = await browser.newPage();

  await page.setContent(htmlContent, {
    waitUntil: ["domcontentloaded", "networkidle2"],
  });

  const bufferImage = await page.screenshot({ type: "png", fullPage: false });
  await browser.close();
  res.header("Content-Type", "image/png");

  return res.send(bufferImage);
});

server.listen(3000, () => console.log(":3000"));
